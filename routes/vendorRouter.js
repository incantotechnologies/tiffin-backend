const express = require("express");
const supabase = require("../dbconnection");
const jwt = require("jsonwebtoken");
const verifyJWT = require("../jwtMiddleware");
const errorCodes = require("../errorCodes");
const multer = require("multer");
const router = express.Router();
const axios = require("axios");
const handleDBError = require("../dbErrorHandler");
require("dotenv").config();
const sharp = require("sharp"); // Add sharp to your imports

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Signup Route
router.post("/signup", async (req, res) => {
  const { name, phoneNumber, apartmentIdLocal, fssai } = req.body;

  try {
    // Insert vendor details into 'vendors' table
    const { error: vendorError } = await supabase
      .from("vendors")
      .insert([{ name, phoneNumber, apartmentId: apartmentIdLocal, fssai }])
      .single(); // Insert only one record and return it

    handleDBError(vendorError);

    // Fetch the inserted vendorId from the 'vendors' table
    const { data: vendorData, error: vendorIdError } = await supabase
      .from("vendors")
      .select("vendorId")
      .eq("phoneNumber", phoneNumber)
      .single();

    handleDBError(vendorIdError);

    const vendorId = vendorData.vendorId;

    // Generate a JWT token with the vendor's name and vendorId
    const token = jwt.sign({ name, vendorId }, process.env.JWT_SECRET);

    // Return the token to the vendor
    return res
      .status(errorCodes.CREATED.status)
      .json({ token, key: 1, message: "vendor signed up successfully." });
  } catch (error) {
    console.error("Error signing up vendor:", error);
    return res
      .status(errorCodes.INTERNAL_SERVER_ERROR.status)
      .json({ message: errorCodes.INTERNAL_SERVER_ERROR.message });
  }
});

function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000);
}

router.post("/verify-contact", async (req, res) => {
  const { phoneNumber } = req.body; // Getting the phone number from the request body
  try {
    // Generate OTP (You can replace this with your own OTP generator logic)
    const OTP = generateOTP();
    const text = `Dear Customer, Your OTP for login is ${OTP} for Incanto App. Do not share it with anyone. Thank you, Incanto Technologies.`;

    // Construct the URL for the SMS API request
    const URL = `${process.env.BASE_SMS_URL}`;

    try {
      // Send the OTP via SMS using axios
      const response = await axios.post(
        URL,
        {
          sender: process.env.SENDER_ID, // The sender's ID (Originator/Alphanumeric ID)
          to: phoneNumber, // Recipient's MSISDN (Phone Number)
          text: text, // OTP message text
          type: process.env.TYPE, // Route type (e.g., 'TRANS')
        },
        {
          headers: {
            "Content-Type": "application/json", // Specify content type as JSON
            apikey: process.env.API_KEY, // API Key for SMS service
          },
        }
      );

      // Check if the response contains an error field (as an example, change based on actual API response structure)
      if (response.data.error === null) {
        return res.status(200).json({
          exists: false,
          message: "OTP sent to the new user successfully",
          OTP, // Send OTP in the response
        });
      } else {
        return res.status(500).json({
          message: "OTP sending failed, please try again later",
          key: 1, // You can replace or add other keys as per your requirement
        });
      }
    } catch (err) {
      // Log the error response and status for better debugging
      console.error(
        "Axios error:",
        err.response ? err.response.data : err.message
      );
      return res.status(500).json({
        message: "Failed to verify contact, please try again later.",
        errorDetails: err.response ? err.response.data : err.message, // Include error details in the response for debugging
      });
    }
  } catch (e) {
    // Catch any other errors in the main try block
    console.error("Error verifying contact:", e.message);
    return res
      .status(500) // Internal server error status
      .json({ message: "An error occurred while processing the request." });
  }
});

router.post("/check-user", async (req, res) => {
  const { phoneNumber } = req.body;

  try {
    // Query the 'vendors' table to check if the phone number exists
    const { data: vendorData, error } = await supabase
      .from("vendors")
      .select("vendorId, name, apartmentId")
      .eq("phoneNumber", phoneNumber)
      .single();

    if (error && error.code !== "PGRST116") {
      // Supabase specific error for no rows
      throw error;
    }

    if (vendorData) {
      // Phone number exists, generate a token
      const { vendorId, name, apartmentId } = vendorData;
      const token = jwt.sign({ name, vendorId }, process.env.JWT_SECRET);
      return res.status(200).json({ exists: true, token, apartmentId });
    } else {
      return res.status(200).json({ exists: false });
    }
  } catch (error) {
    console.error("Error checking vendor existence:", error);
    return res
      .status(errorCodes.INTERNAL_SERVER_ERROR.status)
      .json({ message: errorCodes.INTERNAL_SERVER_ERROR.message });
  }
});

//fetch all the available apartments
router.get("/all-apartments", async (req, res) => {
  try {
    // Fetch all apartments from the database
    const { data: apartments, error } = await supabase
      .from("apartments") // Replace with your table name
      .select("*"); // Fetch only the required fields

    if (error) {
      console.error("Error fetching apartments:", error);
      return res.status(500).json({ error: "Failed to fetch apartments." });
    }

    // Send the list of apartments as a response
    return res.json({ apartments });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "An unexpected error occurred." });
  }
});

// POST route to save a new apartment
router.post("/save-apartment", async (req, res) => {
  const { name, address, latitude, longitude, pincode } = req.body;

  // Validate input
  if (!name || !latitude || !longitude || !pincode) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    // Add the new apartment to the database
    const { data: newApartment, error: insertError } = await supabase
      .from("apartments")
      .insert({ name, latitude, longitude, pincode, address })
      .select();

    if (insertError) {
      console.error("Error adding new apartment:", insertError);
      return res.status(500).json({ error: "Failed to add new apartment." });
    }

    return res.status(201).json({
      message: "Apartment added successfully.",
      apartment: newApartment,
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "An unexpected error occurred." });
  }
});

// Route to add a food item (vendor needs to be authenticated)
// Route to add a food item (vendor needs to be authenticated)
router.post("/add-food-item", verifyJWT, async (req, res) => {
  console.log(
    "form data is ",
    req.body.formData,
    "form data within body is",
    req.body
  );
  // Destructure the necessary fields from the request body, excluding imageUrl
  const {
    name,
    price,
    expiryDate,
    delivery,
    description,
    type,
    category,
    serves,
    tags,
    apartmentId,
    maxOrders,
    isDelivery,
    deliveryDescription,
    deliveryPrice,
  } = req.body;
  const { vendorId } = req.user; // Extract vendorId from the JWT token

  try {
    // Insert the food item into the 'food_items' table and retrieve the foodItemId
    const { data, error } = await supabase
      .from("food_items")
      .insert([
        {
          vendorId,
          name,
          price,
          expiry: expiryDate,
          delivery,
          description,
          type,
          category,
          serves,
          tags,
          apartmentId,
          maxOrders,
          isDelivery,
          deliveryDescription,
          deliveryPrice,
          isVisible:true,
        },
      ])
      .select("foodItemId");

    // Handle database errors
    if (error) throw error;

    console.log(data);

    // Extract the foodItemId from the response
    const foodItemId = data[0].foodItemId;

    // Insert into 'max_orders' table with the retrieved foodItemId
    const { error: maxOrdersError } = await supabase
      .from("max_orders")
      .insert([{ foodItemId, availableOrders: maxOrders }]);

    // Handle errors for max_orders insertion
    if (maxOrdersError) throw maxOrdersError;

    // Return response
    return res.status(201).json({
      message: `Food item '${name}' added successfully.`,
      foodItemId: foodItemId,
    });
  } catch (error) {
    console.error("Error adding food item:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
});

// Route to stop orders
router.post("/stop-orders", verifyJWT, async (req, res) => {
  const { foodItemId } = req.body;

  const { data, error } = await supabase
    .from("max_orders")
    .update({ availableOrders: 0 })
    .eq("foodItemId", foodItemId);

  if (error) {
    console.error("Error updating availableOrders:", error.message);
    return res.status(500).json({ message: "Failed to stop orders", error });
  }

  res.status(200).json({ message: "Orders stopped successfully", data });
});

// Route to resize and upload the image
router.post(
  "/upload-image",
  upload.single("image"), // Handles the image upload
  async (req, res) => {
    try {
      const { foodItemId, apartmentId } = req.body;

      // Ensure that an image was uploaded
      if (!req.file) {
        return res.status(400).json({ message: "No image file uploaded" });
      }

      console.log("Original Image Size (bytes):", req.file.size);

      // Resize the image
      const resizedBuffer = await sharp(req.file.buffer)
        .resize(400, 300) // Resize to 400x300
        .toFormat("jpeg") // Convert to JPEG
        .toBuffer();

      console.log("Resized Image Size (bytes):", resizedBuffer.length);

      // Define the path for storing the image in the bucket
      const filePath = `images/${foodItemId}-${apartmentId}-${Date.now()}.jpeg`;

      // Upload the resized buffer to Supabase Storage
      const { data, error } = await supabase.storage
        .from("images")
        .upload(filePath, resizedBuffer, {
          contentType: req.file.mimetype || "image/jpeg",
        });

      if (error) {
        console.error("Error uploading image to Supabase:", error);
        return res
          .status(500)
          .json({ message: "Failed to upload image to Supabase", error });
      }

      // Generate a public URL to access the image
      const { data: publicUrlData } = supabase.storage
        .from("images")
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      // Update the food_items table with the image URL for the given foodItemId
      const { error: updateError } = await supabase
        .from("food_items")
        .update({ image: publicUrl })
        .eq("foodItemId", foodItemId);

      if (updateError) {
        console.error("Error updating food_items table:", updateError);
        return res.status(500).json({
          message: "Failed to update food_items table",
          error: updateError,
        });
      }

      return res.status(201).json({
        message: "Image uploaded and food_items table updated successfully",
      });
    } catch (error) {
      console.error("Error processing image:", error.message);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

//Route to fetch all the food items uploaded by a particular vendor
router.get("/vendor-food-items", verifyJWT, async (req, res) => {
  const { vendorId } = req.user; // Extract vendorId from the JWT token

  try {
    // Query to get all food items associated with the vendorId
    const { data, error } = await supabase
      .from("food_items")
      .select("*")
      .eq("vendorId", vendorId)
      .eq("isVisible", true);

    // Handle database errors
    if (error) throw error;

    // Return the retrieved food items
    return res.status(200).json({
      message: `Food items retrieved successfully for vendor ${vendorId}.`,
      foodItems: data,
    });
  } catch (error) {
    console.error("Error retrieving food items:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
});

//Router to edit/delete food items
router.put("/edit-food-item/:foodItemId", verifyJWT, async (req, res) => {
  const { foodItemId } = req.params;
  const {
    name,
    price,
    expiryDate,
    delivery,
    description,
    type,
    category,
    serves,
    tags,
    discountPrice,
    maxOrders, // Add maxOrders to the destructuring
  } = req.body;
  const { vendorId } = req.user;

  try {
    // Update the food item
    const { error: updateError } = await supabase
      .from("food_items")
      .update({
        vendorId,
        name,
        price,
        expiry: expiryDate,
        delivery,
        description,
        type,
        category,
        serves,
        tags,
        discountPrice,
        maxOrders, // Update maxOrders in food_items
        isVisible: true,
      })
      .eq("foodItemId", foodItemId);

    if (updateError) {
      return res.status(500).json({
        message: "Failed to update the food item.",
        error: updateError,
      });
    }

    // If maxOrders was provided, also update max_orders table
    if (maxOrders !== undefined) {
      const { error: maxOrdersError } = await supabase
        .from("max_orders")
        .update({ availableOrders: maxOrders })
        .eq("foodItemId", foodItemId);

      if (maxOrdersError) {
        console.error("Error updating max_orders:", maxOrdersError);
        // Don't fail the request, just log the error
      } else {
        console.log(`Synced max_orders for foodItemId ${foodItemId}: ${maxOrders}`);
      }
    }

    return res.status(200).json({
      message: `Food item with ID ${foodItemId} updated successfully.`,
    });
  } catch (error) {
    console.error("Error editing food item:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
});

// Route to stop orders
router.post("/stop-orders", verifyJWT, async (req, res) => {
  const { foodItemId } = req.body;

  const { data, error } = await supabase
    .from("max_orders")
    .update({ availableOrders: 0 })
    .eq("foodItemId", foodItemId);

  if (error) {
    console.error("Error updating availableOrders:", error.message);
    return res.status(500).json({ message: "Failed to stop orders", error });
  }

  res.status(200).json({ message: "Orders stopped successfully", data });
});

//Route to delete food item
router.delete("/delete-food-item", verifyJWT, async (req, res) => {
  try {
    const { foodItemId } = req.body;
    const { vendorId } = req.user;
    // Check if the food item exists and belongs to the vendor
    const { data: foodItem, error: fetchError } = await supabase
      .from("food_items")
      .select("*")
      .eq("foodItemId", foodItemId)
      .eq("vendorId", vendorId)
      .single(); // Retrieve a single item

    // Handle errors or if food item not found
    if (fetchError || !foodItem) {
      return res.status(404).json({
        message: "Food item not found or does not belong to this vendor.",
      });
    }

    // Delete the food item
    const { error: deleteError } = await supabase
      .from("food_items")
      .delete()
      .eq("foodItemId", foodItemId);

    // Handle delete errors
    if (deleteError) {
      return res.status(500).json({
        message: "Failed to delete the food item.",
        error: deleteError,
      });
    }

    return res.status(200).json({
      message: `Food item with ID ${foodItemId} deleted successfully.`,
    });
  } catch (error) {
    console.error("Error deleting food item:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
});
//Route to retrieve all the orders for a given vendor
router.get("/vendor-orders", verifyJWT, async (req, res) => {
  const { vendorId } = req.user; // Extract vendorId from the JWT token
  const { apartmentId } = req.query;

  console.log("vendor id is", vendorId);
  try {
    // Step 1: Fetch orders
    const { data: orders, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("apartmentId", apartmentId); // Fetch orderId, foodItemIds, customerId

    if (orderError) {
      console.error("Error fetching orders:", orderError);
      return res
        .status(500)
        .json({ message: "Error fetching orders", error: orderError });
    }

    const { data: vendorFoodItemIds, error: vendorFoodItemIdsError } =
      await supabase.from("food_items").select("*").eq("vendorId", vendorId);

    if (vendorFoodItemIdsError) {
      console.error(
        "Error fetching vendor food items:",
        vendorFoodItemIdsError
      );
      return res.status(500).json({
        message: "Error fetching vendor food items",
        error: vendorFoodItemIdsError,
      });
    }

    const storeVendorFoodItemIds = vendorFoodItemIds.map(
      (foodItem) => foodItem.foodItemId
    );

    const updatedOrderFoodItemList = [];

    const vendorOrders = [];
    const customerIds = new Set();

    orders.forEach((order) => {
      //console.log("type of food items ids are", typeof(order.foodItemIds))

      customerIds.add(Number(order.customerId));

      const updatedOrderList = order.foodItemIds.map((item) => {
        const [foodItemId, quantity, status, deliveryType] = item.split(",");
        console.log("the type of stuffs are", foodItemId, typeof foodItemId);

        if (storeVendorFoodItemIds.includes(Number(foodItemId))) {
          const vendorDetails = {
            quantity,
            orderId: Number(order.orderId),
            foodItemId: Number(foodItemId),
            status: status === "placed" ? "pending" : status,
            deliveryType,
            customerId: Number(order.customerId),
          };
          vendorOrders.push(vendorDetails);
          if (status.trim() == "placed") {
            return `${foodItemId}, ${quantity},pending,${deliveryType}`;
          }
          return item;
        }
        return item;
      });

      const foodItemId = {
        foodItemIds: updatedOrderList,
        orderId: order.orderId,
        paymentId: order.paymentId,
        customerId: order.customerId,
        apartmentId: order.apartmentId,
      };

      updatedOrderFoodItemList.push(foodItemId);
    });

    if (updatedOrderFoodItemList.length > 0) {
      const { error: updateError } = await supabase
        .from("orders")
        .upsert(updatedOrderFoodItemList, { onConflict: ["orderId"] });

      if (updateError) {
        console.error("Error updating orders:", updateError);
      } else {
        console.log("Orders updated successfully.");
      }

      // Step 5: Fetch customer details for all relevant customerIds
      const { data: customers, error: customerError } = await supabase
        .from("customers")
        .select(
          `
    customerId,
    name,
    phoneNumber,
    apartments (apartmentId, address)
  `
        )
        .in("customerId", Array.from(customerIds));

      if (customerError) {
        console.error(
          "Error fetching customers with apartments:",
          customerError
        );
      } else {
        console.log("Customers with apartments:", customers);
      }

      console.log("customers are", customers);

      const finalOrderDetails = vendorOrders.map((order) => {
        const foodItemDetails = vendorFoodItemIds.find(
          (foodItem) => order.foodItemId === foodItem.foodItemId
        );
        const customerDetails = customers.find(
          (customer) => customer.customerId === order.customerId
        );
        const finalOrderDetailIndividual = {
          quantity: order.quantity,
          customer: customerDetails,
          orderId: order.orderId,
          status: order.status,
          deliveryType: order.deliveryType,
          foodItems: foodItemDetails,
        };

        return finalOrderDetailIndividual;
      });

      return res.status(200).json({
        message: "Vendor orders fetched successfully.",
        orders: finalOrderDetails,
      });
    }

    return res.status(200).json({
      message: "Vendor orders fetched successfully.",
      orders: [],
    });
  } catch (error) {
    console.error("Error fetching vendor orders:", error);
    return res.status(500).json({
      message: "Internal server error",
      error,
    });
  }
});

router.put("/update-order-status", verifyJWT, async (req, res) => {
  const { orderIds, foodItemId, newStatus } = req.body; // Extract orderId, foodItemId, and new status from the request body

  if (newStatus == "prepared") {
    try {
      // Fetch the specific order using the orderId
      const { data: orders, error: fetchError } = await supabase
        .from("orders")
        .select("*")
        .in("orderId", orderIds);

      if (fetchError) {
        console.error("Error fetching the order:", fetchError);
        return res
          .status(500)
          .json({ message: "Error fetching the order", error: fetchError });
      }

      if (!orders) {
        return res.status(404).json({ message: "Order not found." });
      }

      console.log("order: ", orders);

      // Update the specific food item's status within the foodItemIds array
      const updatedCompleteFoodItemIds = orders.map((order) => {
        const updatedFoodItemIds = order.foodItemIds.map((item) => {
          const [id, quantity, status, deliveryType] = item.split(",");

          // Update the status if the foodItemId matches
          if (parseInt(id.trim()) === foodItemId) {
            return `${id},${quantity},${newStatus},${deliveryType}`;
          }
          return item; // Keep unchanged items as they are
        });

        return {
          orderId: order.orderId,
          paymentId: order.paymentId,
          apartmentId: order.apartmentId,
          customerId: order.customerId,
          foodItemIds: updatedFoodItemIds,
        };
      });

      // Save the updated foodItemIds back to the database
      const { error: updateError } = await supabase
        .from("orders")
        .upsert(updatedCompleteFoodItemIds, { onConflict: "orderId" }); // Ensure orderId matches

      if (updateError) {
        console.error("Error updating the order:", updateError);
        return res
          .status(500)
          .json({ message: "Error updating the order", error: updateError });
      }

      return res
        .status(200)
        .json({ message: "Order status updated successfully." });
    } catch (error) {
      console.error("Error updating order status:", error);
      return res.status(500).json({
        message: "Internal server error",
        error,
      });
    }
  } else if (newStatus === "delivered") {
    try {
      // Fetch the specific order using the orderId
      const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select("orderId, foodItemIds")
        .eq("orderId", orderIds)
        .single();

      if (fetchError) {
        console.error("Error fetching the order:", fetchError);
        return res
          .status(500)
          .json({ message: "Error fetching the order", error: fetchError });
      }

      if (!order) {
        return res.status(404).json({ message: "Order not found." });
      }

      console.log("order: ", order);

      // Update the specific food item's status within the foodItemIds array
      const updatedFoodItemIds = order.foodItemIds.map((item) => {
        const [id, quantity, status, deliveryType] = item.split(",");

        // Update the status if the foodItemId matches
        if (foodItemId.includes(parseInt(id.trim()))) {
          return `${id},${quantity},${newStatus},${deliveryType}`;
        }
        return item; // Keep unchanged items as they are
      });

      // Save the updated foodItemIds back to the database
      const { error: updateError } = await supabase
        .from("orders")
        .update({ foodItemIds: updatedFoodItemIds })
        .eq("orderId", orderIds)
        .single();

      if (updateError) {
        console.error("Error updating the order:", updateError);
        return res
          .status(500)
          .json({ message: "Error updating the order", error: updateError });
      }

      return res
        .status(200)
        .json({ message: "Order status updated successfully." });
    } catch (error) {
      console.error("Error updating order status:", error);
      return res.status(500).json({
        message: "Internal server error",
        error,
      });
    }
  }
});

router.get("/reviews", verifyJWT, async (req, res) => {
  const { vendorId } = req.user;
  try {
    // Query to get reviews and customer details associated with the vendorId
    const { data, error } = await supabase
      .from("reviews")
      .select(
        `
  *,
  customer:customerId (
    customerId,
    name,
    phoneNumber
  )
`
      )
      .eq("vendorId", vendorId);

    // Handle database errors
    if (error) throw error;

    // Return the retrieved food items
    return res.status(200).json({
      message: `Reviews fetched succesfully for vendor ${vendorId}.`,
      reviews: data,
    });
  } catch (error) {
    console.error("Error retrieving food items:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
});

//
router.get("/vendor-details", verifyJWT, async (req, res) => {
  const { vendorId } = req.user;
  try {
    // Fetch vendor details from the vendors table
    const { data: vendorData, error: vendorError } = await supabase
      .from("vendors")
      .select("*")
      .eq("vendorId", vendorId)
      .single();

    if (vendorError) {
      console.error("Error fetching vendor details:", vendorError);
      return res.status(500).json({
        message: "Failed to fetch vendor details",
        error: vendorError,
      });
    }

    // Fetch image base64 from vendor-images table
    const { data: imageData, error: imageError } = await supabase
      .from("vendor_images")
      .select("image")
      .eq("vendorId", vendorId)
      .single();

    if (imageError && imageError.code !== "PGRST116") {
      // Ignore "no rows found" error
      console.error("Error fetching vendor image:", imageError);
      return res
        .status(500)
        .json({ message: "Failed to fetch vendor image", error: imageError });
    }

    // Construct vendor details object
    const vendorDetails = { ...vendorData };
    if (imageData && imageData.image) {
      vendorDetails.image = imageData.image;
    }

    return res.status(200).json({
      message: `Details fetched successfully for vendor ${vendorId}.`,
      vendorDetails,
    });
  } catch (error) {
    console.error("Error retrieving vendor details:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
});

router.put("/update-vendor-details", verifyJWT, async (req, res) => {
  const { vendorId } = req.user; // Vendor ID from the verified JWT token
  const { email, about } = req.body; // New details from the request body

  try {
    // Start a transaction to ensure atomicity
    const { error: updateError } = await supabase
      .from("vendors")
      .update({ email, note: about })
      .eq("vendorId", vendorId); // Update the vendor's details

    // Handle database update errors
    if (updateError)
      throw new Error(`Error updating vendor details: ${updateError.message}`);

    // Return success response
    return res.status(200).json({
      message: `Vendor details updated successfully for vendor ${vendorId}.`,
    });
  } catch (error) {
    console.error("Error updating vendor details:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

//
router.post(
  "/upload-vendor-image",
  verifyJWT,
  upload.single("image"),
  async (req, res) => {
    try {
      // Read vendorId from the request body
      const { vendorId } = req.user;

      // Ensure that an image was uploaded
      if (!req.file) {
        return res.status(400).json({ message: "No image file uploaded" });
      }

      // Convert the file buffer to a base64 string
      const imageBase64 = req.file.buffer.toString("base64");

      // Check if an image already exists for the vendor
      const { data: existingImages, error: fetchError } = await supabase
        .from("vendor_images")
        .select("vendorImageId")
        .eq("vendorId", vendorId);

      if (fetchError) {
        console.error("Error checking existing image:", fetchError);
        return res.status(500).json({
          message: "Error checking existing image",
          error: fetchError,
        });
      }

      if (existingImages.length > 0) {
        // Update the existing image
        const { error: updateError } = await supabase
          .from("vendor_images")
          .update({ image: imageBase64 })
          .eq("vendorId", vendorId);

        if (updateError) {
          console.error("Error updating image in database:", updateError);
          return res.status(500).json({
            message: "Failed to update image in database",
            error: updateError,
          });
        }

        return res.status(200).json({
          message: "Image updated successfully",
        });
      } else {
        // Insert the new image
        const { error: insertError } = await supabase
          .from("vendor_images")
          .insert([{ image: imageBase64, vendorId }]);

        if (insertError) {
          console.error("Error saving image to database:", insertError);
          return res.status(500).json({
            message: "Failed to save image to database",
            error: insertError,
          });
        }

        return res.status(201).json({
          message: "Image uploaded and stored successfully",
        });
      }
    } catch (error) {
      console.error("Error processing image:", error);
      return res.status(500).json({ message: "Internal server error", error });
    }
  }
);

// Route to update available orders for a food item
router.post("/update-available-orders", verifyJWT, async (req, res) => {
  const { foodItemId, availableOrders } = req.body;
  const { vendorId } = req.user;

  try {
    // Verify the food item belongs to this vendor
    const { data: foodItem, error: foodItemError } = await supabase
      .from("food_items")
      .select("vendorId")
      .eq("foodItemId", foodItemId)
      .single();

    if (foodItemError || !foodItem) {
      return res.status(404).json({ message: "Food item not found" });
    }

    if (foodItem.vendorId !== vendorId) {
      return res.status(403).json({ message: "Unauthorized to update this food item" });
    }

    // Update the max_orders table
    const { data, error } = await supabase
      .from("max_orders")
      .update({ availableOrders })
      .eq("foodItemId", foodItemId);

    if (error) {
      console.error("Error updating max_orders:", error);
      return res.status(500).json({ message: "Failed to update available orders", error });
    }

    console.log(`Updated availableOrders for foodItemId ${foodItemId}: ${availableOrders}`);
    
    res.status(200).json({ 
      message: "Available orders updated successfully", 
      foodItemId,
      availableOrders 
    });
  } catch (error) {
    console.error("Error updating available orders:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
});

module.exports = router;
