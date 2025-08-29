// const { constant } = require("../helpers/constant");
// const errorHandler = (err, req, res, next) => {
//     const statusCode = res.statusCode ? res.statusCode : 500;

//     res.status(statusCode);

//     switch (statusCode) {
//         case constant.NOT_FOUND:
//             res.json({
//                 title: "Not Found",
//                 message: err.message,
//                 stackTrace: err.stack,
//             });

//             break;
//         case constant.NOT_FOUND:
//             res.json({
//                 title: "Forbidden",
//                 message: err.message,
//                 stackTrace: err.stack,
//             });

//             break;
//         case constant.SERVER_ERROR:
//             res.json({
//                 title: "SERVER_ERROR",
//                 message: err.message,
//                 stackTrace: err.stack,
//             });

//             break;
//         case constant.UNAUTHORIZED:
//             res.json({
//                 title: "UNAUTHORIZED",
//                 message: err.message,
//                 stackTrace: err.stack,
//             });

//             break;
//         case constant.VALIDATION_ERROR:
//             res.json({
//                 title: "VALIDATION_ERROR",
//                 message: err.message,
//                 stackTrace: err.stack,
//             });

//             break;

//         default:
//             console.log("All clear");
//             break;
//     }
//     next();

// }

// module.exports = errorHandler;

const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    status: false,
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack
  });
};

module.exports = { notFound, errorHandler };
