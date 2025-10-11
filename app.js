const express = require('express');
const adminAuthRoutes = require('./routes/adminRouter');
const vendorAuthRoutes = require('./routes/vendorRouter');
const customerAuthRoutes = require('./routes/customerRouter');
const supabase = require('./dbconnection');
const app = express();
const cron = require('node-cron');

const PORT = 3000;

// Middleware to parse JSON data
app.use(express.json());

// Use the auth routes
app.use('/auth/vendor', vendorAuthRoutes);
app.use('/auth/customer', customerAuthRoutes);
app.use('/auth/admin', adminAuthRoutes);

app.get('/', (req, res) => res.json({message:"welcome to tiffin box server"}));


const deleteExpiredFoodItems = async () => {
    try {
        // Get the current local time and convert it to GMT
        const localTime = new Date();
        const gmtTime = new Date(localTime.getTime() - localTime.getTimezoneOffset() * 60000).toISOString();

        // Perform the deletion with the GMT time
        const { error } = await supabase
            .from('food_items')
            .delete()
            .lte('expiry', gmtTime);

        if (error) {
            console.error('Error deleting expired food items:', error);
        } else {
            console.log('Expired food items deleted successfully at', new Date());
        }
    } catch (error) {
        console.error('Error in deleteExpiredFoodItems function:', error);
    }
};


// cron.schedule('*/30 * * * *', deleteExpiredFoodItems);
// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
