const success = (res, data, status = 200) => {
    const response = {
        success: true,
        data
    };

    if (Array.isArray(data)) {
        response.count = data.length;
    }

    return res.status(status).json(response);
};

const error = (res, message, status = 500) => {
    return res.status(status).json({
        success: false,
        error: message
    });
};

module.exports = { success, error };
