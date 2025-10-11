const express = require('express');
const supabase = require("../dbconnection");
const router = express.Router();

router.post('/delete-expired-food', async (req, res) => {
  try {
    const { randKey } = req.body;
    if (randKey !== process.env.randKey) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    const currentTime = new Date().toISOString();

    // Step 1: Get expired food items
    const { data: expiredItems, error: expiredError } = await supabase
      .from('food_items')
      .select('foodItemId')
      .lt('expiry', currentTime);

    if (expiredError) {
      console.error('Error fetching expired food items:', expiredError.message);
      return res.status(500).json({ success: false, error: expiredError.message });
    }

    // Step 2: Fetch all orders
    const { data: allOrders, error: ordersError } = await supabase
      .from('orders')
      .select('orderId, foodItemIds');

    if (ordersError) {
      console.error('Error fetching orders:', ordersError.message);
      return res.status(500).json({ success: false, error: ordersError.message });
    }

    const expiredFoodIds = expiredItems.map(item => String(item.foodItemId));
    const foodItemStatusMap = {};
    const foodItemOrderMap = {};

    // Step 3: Map statuses and orders per foodItemId
    for (const order of allOrders) {
      if (!order.foodItemIds || !Array.isArray(order.foodItemIds)) continue;

      for (const entry of order.foodItemIds) {
        const parts = entry.split(',');
        if (parts.length < 3) continue;

        const foodId = parts[0].trim();
        const status = parts[2].trim().toLowerCase();

        if (!expiredFoodIds.includes(foodId)) continue;

        if (!foodItemStatusMap[foodId]) {
          foodItemStatusMap[foodId] = [];
        }
        foodItemStatusMap[foodId].push(status);

        if (!foodItemOrderMap[foodId]) {
          foodItemOrderMap[foodId] = [];
        }
        foodItemOrderMap[foodId].push({
          orderId: order.orderId,
          originalArray: order.foodItemIds,
          rawEntry: entry
        });
      }
    }

    // Step 4: Process each expired food item
    for (const foodItemId of expiredFoodIds) {
      const statuses = foodItemStatusMap[foodItemId] || [];

      if (statuses.length === 0) {
        console.log(`Skipping foodItemId ${foodItemId}: no related statuses found in any order.`);
        continue;
      }

      const allDelivered = statuses.every(status => status === 'delivered');

      const ordersContainingItem = foodItemOrderMap[foodItemId] || [];
      const isPartOfMixedOrder = ordersContainingItem.some(({ originalArray, rawEntry }) => {
        return originalArray.length > 1;
      });

      if (allDelivered && !isPartOfMixedOrder) {
        // Safe to delete — only in solo orders
        const { error: deleteError } = await supabase
          .from('food_items')
          .delete()
          .eq('foodItemId', foodItemId);

        if (deleteError) {
          console.error(`Error deleting foodItemId ${foodItemId}:`, deleteError.message);
        } else {
          console.log(`Deleted foodItemId ${foodItemId}`);
        }
      } else if (allDelivered && isPartOfMixedOrder) {
        // Remove entry from each order it's part of
        for (const { orderId, originalArray, rawEntry } of ordersContainingItem) {
          const updatedArray = originalArray.filter(entry => entry.trim() !== rawEntry.trim());

          const { error: updateError } = await supabase
            .from('orders')
            .update({ foodItemIds: updatedArray })
            .eq('orderId', orderId);

          if (updateError) {
            console.error(`Error updating order for foodItemId ${foodItemId}:`, updateError.message);
          } else {
            console.log(`Removed foodItemId ${foodItemId} from order ${orderId}`);
          }
        }

        // Then delete the food item
        const { error: deleteError } = await supabase
          .from('food_items')
          .delete()
          .eq('foodItemId', foodItemId);

        if (deleteError) {
          console.error(`Error deleting foodItemId ${foodItemId}:`, deleteError.message);
        } else {
          console.log(`Deleted foodItemId ${foodItemId} after removing from mixed orders`);
        }

      } else {
        // Not all delivered → just hide the item
        const { error: updateError } = await supabase
          .from('food_items')
          .update({ isVisible: false })
          .eq('foodItemId', foodItemId);

        if (updateError) {
          console.error(`Error hiding foodItemId ${foodItemId}:`, updateError.message);
        } else {
          console.log(`Hid foodItemId ${foodItemId}`);
        }
      }
    }

    return res.status(200).json({ success: true, message: 'Expired food items processed.' });

  } catch (err) {
    console.error('Unexpected error:', err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
