/**
 * 404 Not Found Handler
 */
export const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
};

/**
 * Global Error Handler
 */
export const errorHandler = (err, req, res, next) => {
    // Default to 500 if status code is 200 (Express default)
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

    res.status(statusCode).json({
        success: false,
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
        ...(err.errors && { errors: err.errors })
    });
};

export default { notFound, errorHandler };
