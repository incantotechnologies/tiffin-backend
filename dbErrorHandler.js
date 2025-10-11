const handleDBError = (error) => {
    if (error) {
        console.error('Database error:', error); // Log the error for debugging

        // Customize the message returned based on the type of error (if needed)
        const message = error.message || 'An unknown database error occurred';

        console.log("DB error is:", message);
        // Optionally, you can choose to throw a custom error
        const dbError = new Error(message);
        dbError.code = error.code; // Attach the original error code if it exists
        dbError.details = error.details; // Attach any extra details provided by Supabase
        dbError.hint = error.hint; // Attach a hint if provided by Supabase
        
        // Throw the error so it can be handled by your error handling middleware or caught elsewhere
        throw dbError;
    }
};

module.exports = handleDBError;
