const express = require("express");
const supabase = require("../dbconnection");
const jwt = require("jsonwebtoken");
const verifyJWT = require("../jwtMiddleware");
const errorCodes = require("../errorCodes");
const router = express.Router();
const handleDBError = require("../dbErrorHandler");
require("dotenv").config();
const axios = require("axios");
const nodemailer = require("nodemailer");

router.post("/signup", async (req, res) => {
  const { name, phoneNumber, apartmentIdLocal } = req.body;

  try {
    // Insert customer details into 'customers' table
    const { error: customerError } = await supabase
      .from("customers")
      .insert([{ name, phoneNumber, apartmentId: apartmentIdLocal }])
      .single(); // Insert only one record and return it

    handleDBError(customerError);

    // Fetch the inserted customerId from the 'customers' table
    const { data: customerData, error: customerIdError } = await supabase
      .from("customers")
      .select("customerId")
      .eq("phoneNumber", phoneNumber)
      .single();

    handleDBError(customerIdError);

    const customerId = customerData.customerId;

    // Generate a JWT token with the customer's name and customerId
    const token = jwt.sign({ name, customerId }, process.env.JWT_SECRET);

    // Return the token to the customer
    return res
      .status(errorCodes.CREATED.status)
      .json({ token, message: "Customer signed up successfully." });
  } catch (error) {
    console.error("Error signing up customer:", error);
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
      .from("customers")
      .select("customerId, name, apartmentId")
      .eq("phoneNumber", phoneNumber)
      .single();

    if (error && error.code !== "PGRST116") {
      // Supabase specific error for no rows
      throw error;
    }

    if (vendorData) {
      // Phone number exists, generate a token
      const { customerId, name, apartmentId } = vendorData;
      const token = jwt.sign({ name, customerId }, process.env.JWT_SECRET);
      return res.status(200).json({ exists: true, token, apartmentId });
    } else {
      // Phone number does not exist
      return res.status(200).json({ exists: false });
    }
  } catch (error) {
    console.error("Error checking customer existence:", error);
    return res
      .status(errorCodes.INTERNAL_SERVER_ERROR.status)
      .json({ message: errorCodes.INTERNAL_SERVER_ERROR.message });
  }
});

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

// Route to fetch food items from the 'food_items' table that match the apartmentId
router.post("/get-food-items", verifyJWT, async (req, res) => {
  const { apartmentId, foodItemIds } = req.body;

  try {
    let query = supabase
      .from("food_items")
      .select("*")
      .eq("apartmentId", apartmentId)
      .eq("isVisible", true);

    if (foodItemIds && foodItemIds.length > 0) {
      query = query.in("foodItemId", foodItemIds);
    }
    
    const { data: foodItems, error } = await query;
    if (error) throw error;

    console.log("foodItemIds:", foodItemIds);
    console.log("req.body:", req.body);
    console.log("Fetched food items for apartment:", apartmentId);
    
    // Get available orders for all food items
    const foodItemIdsArray = foodItems.map(item => item.foodItemId);
    let ordersData = [];
    
    if (foodItemIdsArray.length > 0) {
      const { data: orders, error: ordersError } = await supabase
        .from("max_orders")
        .select("*")
        .in("foodItemId", foodItemIdsArray);

      if (!ordersError && orders) {
        ordersData = orders;
        console.log("Fetched orders data:", ordersData);
      }
    }

    // Combine food items with available orders
    const updatedFoodItemsList = foodItems.map(item => {
      const orderInfo = ordersData.find(order => order.foodItemId === item.foodItemId);
      const isNewItem = !existingFoodItemIds.includes(item.foodItemId);
      
      console.log(`Food item ${item.foodItemId}: availableOrders = ${orderInfo ? orderInfo.availableOrders : 0}`);
      
      return {
        ...item,
        // Only include image for new food items
        ...(isNewItem && { image: item.image }),
        availableOrders: orderInfo ? orderInfo.availableOrders : 0
      };
    });

    console.log("Returning food items count:", updatedFoodItemsList.length);

    return res.status(200).json({ 
      foodItems: updatedFoodItemsList
    });
    
  } catch (error) {
    console.error("Error fetching food items:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

router.get("/get-vendors", verifyJWT, async (req, res) => {
  const { apartmentId } = req.query; // Assuming apartmentId is stored in the JWT payload
  try {
    // Fetch all vendors matching the apartmentId
    const { data: vendors, error: vendorError } = await supabase
      .from("vendors")
      .select("*")
      .eq("apartmentId", apartmentId);

    if (vendorError) {
      console.error("Error fetching vendors:", vendorError);
      return res
        .status(500)
        .json({ message: "Failed to fetch vendors", error: vendorError });
    }

    if (!vendors || vendors.length === 0) {
      return res
        .status(404)
        .json({ message: "No vendors found for the given apartmentId" });
    }

    // Fetch images for all vendors in a single query
    const vendorIds = vendors.map((vendor) => vendor.vendorId); // Extract all vendor IDs
    const { data: images, error: imageError } = await supabase
      .from("vendor_images")
      .select("vendorId, image")
      .in("vendorId", vendorIds);

    if (imageError) {
      console.error("Error fetching vendor images:", imageError);
      return res
        .status(500)
        .json({ message: "Failed to fetch vendor images", error: imageError });
    }

    // Map images to their corresponding vendorId for easy lookup
    const imageMap = images.reduce((acc, img) => {
      acc[img.vendorId] = img.image;
      return acc;
    }, {});

    // Combine vendor details with their corresponding images
    const vendorDetails = vendors.map((vendor) => ({
      ...vendor,
      image: imageMap[vendor.vendorId] || null, // Assign image or null if not available
    }));

    return res.status(200).json({
      message: `Vendors fetched successfully for apartmentId ${apartmentId}.`,
      vendors: vendorDetails,
    });
  } catch (error) {
    console.error("Error retrieving vendor details:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
});

// Route to fetch vendor details along with reviews
router.get("/get-reviews", verifyJWT, async (req, res) => {
  const { vendorId, key } = req.query; // Extract vendorId from the request query

  try {
    // Step 1: Fetch vendor details
    const { data: vendorDetails, error: vendorError } = await supabase
      .from("vendors")
      .select("*") // Select all columns from the vendors table
      .eq("vendorId", vendorId) // Filter by vendorId
      .single(); // Fetch a single row

    if (vendorError) {
      console.error("Error fetching vendor details:", vendorError);
      return res
        .status(500)
        .json({ message: "Error fetching vendor details", error: vendorError });
    }

    // Step 2: Fetch apartment details using apartmentId from vendor details
    const { apartmentId } = vendorDetails; // Extract apartmentId
    const { data: apartmentDetails, error: apartmentError } = await supabase
      .from("apartments")
      .select("*") // Select all columns from the apartments table
      .eq("apartmentId", apartmentId) // Filter by apartmentId
      .single(); // Fetch a single row

    if (apartmentError) {
      console.error("Error fetching apartment details:", apartmentError);
      return res.status(500).json({
        message: "Error fetching apartment details",
        error: apartmentError,
      });
    }

    // Step 3: Combine vendor and apartment details
    const combinedDetails = {
      ...vendorDetails,
      apartment: apartmentDetails, // Add apartment details under 'apartment' key
    };

    // If key is 0, return vendor details only
    if (key === 0) {
      return res.status(200).json({ vendor: combinedDetails });
    }

    // Step 2: Fetch reviews for the vendor
    // Step 2: Fetch reviews for the vendor and include customer names
    const { data: reviews, error: reviewError } = await supabase
      .from("reviews")
      .select(
        `
    *, 
    customers (name)  -- Include the 'name' column from the 'customers' table
`
      )
      .eq("vendorId", vendorId); // Filter reviews by vendorId

    if (reviewError) {
      console.error("Error fetching reviews:", reviewError);
      return res
        .status(500)
        .json({ message: "Error fetching reviews", error: reviewError });
    }

    const { data: imageData, error: imageError } = await supabase
      .from("vendor_images")
      .select("image")
      .eq("vendorId", vendorId)
      .single();

    // Step 3: Combine vendor details and reviews
    const vendorWithReviews = {
      ...combinedDetails,
      image: imageData?.image || null,
      reviews, // Include reviews as a nested array
    };

    // Send the combined data as the response
    return res.status(200).json({ vendor: vendorWithReviews });
  } catch (error) {
    // If any other error occurs, handle it here and return the appropriate response
    console.error("Error fetching vendor details and reviews:", error);
    return res.status(500).json({
      message: "Internal server error",
      error,
    });
  }
});

// Route to write a review
router.post("/write-review", verifyJWT, async (req, res) => {
  const { vendorId, rating, content } = req.body; // Extract fields from the request payload
  const { customerId } = req.user; // Extract customerId from the verified JWT token

  try {
    // Validate rating (should be between 1 and 5)
    if (rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ message: "Rating must be between 1 and 5." });
    }

    // Fetch the current number of reviews for the vendor
    const { count: reviewCount, error: countError } = await supabase
      .from("reviews")
      .select("*", { count: "exact", head: true })
      .eq("vendorId", vendorId);

    if (countError) {
      console.error("Error fetching review count:", countError);
      return res
        .status(500)
        .json({ message: "Error fetching review count", error: countError });
    }

    // Fetch the current rating of the vendor
    const { data: vendorData, error: vendorError } = await supabase
      .from("vendors")
      .select("rating")
      .eq("vendorId", vendorId)
      .single();

    if (vendorError) {
      console.error("Error fetching vendor rating:", vendorError);
      return res
        .status(500)
        .json({ message: "Error fetching vendor rating", error: vendorError });
    }

    const currentRating = vendorData?.rating || 0;

    // Calculate the new rating
    const newRating =
      (currentRating * reviewCount + rating) / (reviewCount + 1);

    // Update the vendor's rating in the 'vendors' table
    const { error: updateError } = await supabase
      .from("vendors")
      .update({ rating: newRating })
      .eq("vendorId", vendorId);

    if (updateError) {
      console.error("Error updating vendor rating:", updateError);
      return res
        .status(500)
        .json({ message: "Error updating vendor rating", error: updateError });
    }

    // Insert the review into the 'reviews' table
    const { data: reviewData, error: reviewError } = await supabase
      .from("reviews")
      .insert([
        {
          customerId,
          vendorId,
          rating,
          content,
        },
      ])
      .select();

    if (reviewError) {
      console.error("Error writing review:", reviewError);
      return res
        .status(500)
        .json({ message: "Error writing review", error: reviewError });
    }
    // Successfully updated the vendor rating
    return res.status(201).json({
      message: "Review written and vendor rating updated successfully.",
      review: reviewData,
      newRating,
    });
  } catch (error) {
    console.error("Error writing review:", error);
    return res.status(500).json({
      message: "Internal server error",
      error,
    });
  }
});

// Route to fetch all orders that match the customerId
router.post("/place-order", verifyJWT, async (req, res) => {
  const { foodItems, apartmentId } = req.body; // Extract food items from the request payload

  console.log("req body is ", req.body);

  const { customerId } = req.user; // Extract customerId from the verified JWT token

  const paymentId = makePaymentId(10);

  try {
    // Validate inputs
    if (!Array.isArray(foodItems) || foodItems.length === 0) {
      return res
        .status(400)
        .json({ message: "foodItems must be a non-empty array." });
    }

    // Construct the foodItemIds string
    // const foodItemIds = foodItems.map(async (item) => {
    //   const { data: foodItem, error } = await supabase
    //   .from("food_items")
    //   .select("ordersAvailable") // Select all columns
    //   .eq("foodItemId", item.foodItemId); // Filter to only include items with the matching apartmentId

    //   const ordersAvailable = foodItem.ordersAvailable - item.quantity;
    //    const isUpdated = true;
    //   const { foodUpdateData, foodUpdateError } = await supabase
    //     .from("food_items") // Table name
    //     .update({ordersAvailable, isUpdated}) // Fields to update
    //     .eq("foodItemId", item.foodItemId); // Filtering by food item ID
    //     console.log("food item update data is", foodUpdateData)

    //   if (foodUpdateError) throw error;
    //   return `${item.foodItemId},${item.quantity},placed`;
    // });

    const updateOrdersAndGenerateIds = async (foodItems) => {
      try {
        // Process each food item and collect update results
        const updatePromises = foodItems.map(async (foodItem) => {
          const { foodItemId, quantity, deliveryType } = foodItem;
    
          // Fetch the current availableOrders from max_orders
          const { data, error } = await supabase
            .from("max_orders")
            .select("availableOrders")
            .eq("foodItemId", foodItemId)
            .single();
    
          if (error) {
            console.error(`Error fetching availableOrders for foodItemId ${foodItemId}:`, error);
            return `${foodItemId},${quantity},${deliveryType},failed`;
          }
    
          const currentOrders = data?.availableOrders || 0;
          const updatedOrders = Math.max(currentOrders - quantity, 0); // Ensure it doesn't go negative
    
          // Update the availableOrders in max_orders
          const { error: updateError } = await supabase
            .from("max_orders")
            .update({ availableOrders: updatedOrders })
            .eq("foodItemId", foodItemId);
    
          if (updateError) {
            console.error(`Error updating availableOrders for foodItemId ${foodItemId}:`, updateError);
            return `${foodItemId},${quantity},${deliveryType},failed`;
          }
    
          console.log(`Updated availableOrders for foodItemId ${foodItemId}: ${updatedOrders}`);
          console.log("looooooooooooooooooooooooooooooooooooooooooooooooooook at me");
          console.log(`${foodItemId},${quantity},placed,${deliveryType}`)
          return `${foodItemId},${quantity},placed,${deliveryType}`;
        });
    
        // Wait for all updates and collect results
        const results = await Promise.all(updatePromises);
        console.log("Update results:", results);
        return results; // Return the array of formatted strings
      } catch (error) {
        console.error("Error in updateOrdersAndGenerateIds:", error);
        return [];
      }
    };    
    
    const foodItemIds = await updateOrdersAndGenerateIds(foodItems);

    /*
            Example foodItemIds for above input:
            ["1,2,placed", "3,1,placed", "5,1,placed"]
        */

    if (!paymentId || typeof paymentId !== "string") {
      return res
        .status(400)
        .json({ message: "paymentId is required and must be a string." });
    }

    // Insert the order into the 'orders' table
    const { data, error } = await supabase.from("orders").insert([
      {
        customerId,
        foodItemIds,
        paymentId,
        apartmentId,
      },
    ]);

    // Handle any error during the insert operation
    if (error) {
      console.error("Error placing order:", error);
      return res.status(500).json({ message: "Error placing order", error });
    }

    // Successfully placed the order
    return res.status(201).json({
      message: "Order placed successfully.",
      order: data,
    });
  } catch (error) {
    // Handle any other unexpected errors
    console.error("Error placing order:", error);
    return res.status(500).json({
      message: "Internal server error",
      error,
    });
  }
});

// Helper function to generate a random paymentId
function makePaymentId(length) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}
router.get("/fetch-orders", verifyJWT, async (req, res) => {
  const { customerId } = req.user; // Extract customerId from the verified JWT token

  try {
    // Step 1: Fetch orders from the 'orders' table for the given customerId
    const { data: orders, error: orderError } = await supabase
      .from("orders")
      .select("*") // Select only relevant columns
      .eq("customerId", customerId);

    // Handle database errors
    if (orderError) {
      console.error("Error fetching orders:", orderError);
      return res
        .status(500)
        .json({ message: "Error fetching orders", error: orderError });
    }

    // Step 2: If no orders are found for the customer
    if (!orders || orders.length === 0) {
      return res
        .status(404)
        .json({ message: "No orders found for this customer." });
    }

    // Step 3: Extract foodItemIds from orders
    const allFoodItemIds = [];
    orders.forEach((order) => {
      order.foodItemIds.forEach((item) => {
        const [foodItemId] = item.split(","); // Extract foodItemId
        allFoodItemIds.push(Number(foodItemId)); // Convert to number and push into array
      });
    });

    // Step 4: Fetch food items matching the extracted foodItemIds
    const { data: foodItems, error: foodItemError } = await supabase
      .from("food_items")
      .select("*")
      .in("foodItemId", allFoodItemIds); // Fetch food items that match the foodItemIds

    if (foodItemError) {
      console.error("Error fetching food items:", foodItemError);
      return res
        .status(500)
        .json({ message: "Error fetching food items", error: foodItemError });
    }

    // Step 5: Map the orders with their corresponding food items and quantity
    const enrichedOrders = orders.map((order) => {
      const enrichedFoodItems = order.foodItemIds
        .map((item) => {
          const [foodItemId, quantity, status] = item.split(","); // Extract foodItemId and quantity
          const matchedFoodItem = foodItems.find(
            (food) => food.foodItemId == foodItemId
          );
          if (matchedFoodItem) {
            return {
              ...matchedFoodItem,
              quantity: Number(quantity),
              status: status,
            };
          }
          return null; // If no matching food item found
        })
        .filter((item) => item !== null); // Filter out null values (if any)

      return {
        orderId: order.orderId,
        foodItems: enrichedFoodItems, // Include food item details with quantities
        status: order.status, // Include order status
      };
    });

    // Step 6: Return the enriched orders
    return res.status(200).json({
      message: "Orders fetched successfully.",
      orders: enrichedOrders,
    });
  } catch (error) {
    // Handle unexpected errors
    console.error("Error fetching orders:", error);
    return res.status(500).json({
      message: "Internal server error",
      error,
    });
  }
});

router.get("/customer-details", verifyJWT, async (req, res) => {
  const { customerId } = req.user; // Extract customerId from the verified JWT token
  const { apartmentId } = req.query;

  try {
    // Step 1: Fetch orders from the 'orders' table for the given customerId
    const { data: customerDetails, error: orderError } = await supabase
      .from("customers")
      .select("*") // Select only relevant columns
      .eq("customerId", customerId)
      .single();

    // Handle database errors
    if (orderError) {
      console.error("Error fetching customer details:", orderError);
      return res.status(500).json({
        message: "Error fetching customer details",
        error: orderError,
      });
    }

    const { data: customerAddress, error: addressError } = await supabase
      .from("apartments")
      .select("*") // Select only relevant columns
      .eq("apartmentId", apartmentId)
      .single();

    // Handle database errors
    if (addressError) {
      console.error("Error fetching orders:", addressError);
      return res.status(500).json({
        message: "Error fetching customer details",
        error: addressError,
      });
    }

    // Step 6: Return the enriched orders
    return res.status(200).json({
      message: "customer details fetched successfully.",
      customer: { ...customerDetails, apartment: customerAddress },
    });
  } catch (error) {
    // Handle unexpected errors
    console.error("Error fetching customer details:", error);
    return res.status(500).json({
      message: "Internal server error",
      error,
    });
  }
});

router.post("/available-orders", verifyJWT, async (req, res) => {
  const { foodItemIds } = req.body; // Extract fields from the request payload

  try {
    // Insert the review into the 'reviews' table
    const { data, error } = await supabase
    .from("max_orders")
    .select("*")
    .in("foodItemId", foodItemIds);

    // Handle any error during the insert operation
    if (error) {
      console.error("Error fetching available orders", error);
      return res.status(500).json({ message: "Error fetching available orders", error });
    }

    // Successfully inserted the review
    return res.status(201).json({
      message: "available orders fetched successfully",
      ordersAvailable: data,
    });
  } catch (error) {
    // Handle any other unexpected errors
    console.error("Error fetching available orders:", error);
    return res.status(500).json({
      message: "Internal server error",
      error,
    });
  }
});

async function sendEmailToRecepient(name, query) {
  try {
      await transporter.sendMail(mailOptionsToUser(name, query));
      await transporter.sendMail(mailOptionsToUserMe(name, query));
  } catch (error) {
      console.error("Error sending user email:", error);
      throw new Error("Email to recipient failed");
  }
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
      user: process.env.SENDER_MAIL_ID,
      pass: process.env.SENDER_MAIL_SECRET_KEY,
  },
});

const mailOptionsToUser = (name, query) => {
  return {
      from: process.env.SENDER_MAIL_ID,
      to: process.env.SENDER_MAIL_ID,
      subject: `TIFFIN BLOX: Query from Customer ${name}`,
      text: `${query}`,
  };
};

const mailOptionsToUserMe = (name, query) => {
  return {
    from: process.env.SENDER_MAIL_ID,
    to: process.env.DEV_MAIL_ID,
    subject: `TIFFIN BLOX: Query from Customer ${name}`,
    text: `${query}`,
};
}

router.post("/customer-query", verifyJWT, async (req, res) => {
  const { query } = req.body; // Extract fields from the request payload
  const { customerId, name } = req.user; // Extract customerId from the verified JWT token

  try {
    // Insert the review into the 'reviews' table
    const { data, error } = await supabase.from("query").insert([
      {
        customerId,
        query,
      },
    ]);

    await sendEmailToRecepient(name, query);

    // Handle any error during the insert operation
    if (error) {
      console.error("Error posting query:", error);
      return res.status(500).json({ message: "Error posting query", error });
    }

    // Successfully inserted the review
    return res.status(201).json({
      message: "query posted successfully.",
      query: data,
    });
  } catch (error) {
    // Handle any other unexpected errors
    console.error("Error posting query:", error);
    return res.status(500).json({
      message: "Internal server error",
      error,
    });
  }
});

router.get("/search-apartments", async (req, res) => {
  const { query } = req.query;

  try {
    if (!query || query.length < 3) {
      return res.status(400).json({ 
        message: "Query must be at least 3 characters long" 
      });
    }

    const { data: apartments, error } = await supabase
      .from("apartments")
      .select("id, name, address, pincode")
      .ilike("name", `%${query}%`)
      .limit(10);

    if (error) {
      console.error("Database error:", error);
      throw error;
    }

    return res.status(200).json({ 
      apartments: apartments || [],
      message: "Apartments fetched successfully" 
    });
  } catch (error) {
    console.error("Error searching apartments:", error);
    return res.status(500).json({ 
      message: "Failed to search apartments",
      error: error.message 
    });
  }
});

module.exports = router;
