module.exports = {
    SUCCESS: { status: 200, message: 'Success' },
    CREATED: { status: 201, message: 'Resource created successfully' },
    BAD_REQUEST: { status: 400, message: 'Bad Request' },
    UNAUTHORIZED: { status: 401, message: 'Unauthorized access' },
    FORBIDDEN: { status: 403, message: 'Forbidden: Invalid token' },
    NOT_FOUND: { status: 404, message: 'Resource not found' },
    INTERNAL_SERVER_ERROR: { status: 500, message: 'Internal server error' }
};
