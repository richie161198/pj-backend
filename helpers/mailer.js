
const nodemailer = require("nodemailer");


const sendMail = (to, subject, text) => {
    console.log(process.env.MAIL_ID,
process.env.MAIL_PASSWORD,process.env.SMTP,
process.env.MAIL_PORT)
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP,
            port: process.env.MAIL_PORT,
            auth: {
                user: process.env.MAIL_ID,
                pass: process.env.MAIL_PASSWORD,
            }, secure: false
        })
        const mailData = ({
            from: process.env.MAIL_ID,
            to: to,
            subject: subject,
            text: text,
        })
        transporter.sendMail(mailData,
            // (err, data) => {
            //     if (err) return false
            //     if (data) return true
            // }
        )
        return true;
    } catch (error) {

        console.log(error);
        return false;
    }

}

module.exports = { sendMail }


// const nodemailer = require("nodemailer");

// const sendMail = async (to, subject, text) => {
//   try {
//     const transporter = nodemailer.createTransport({
//       host: process.env.SMTP,
//       port: process.env.MAIL_PORT,
//       secure: false, // Use TLS
//       auth: {
//         user: process.env.MAIL_ID,
//         pass: process.env.MAIL_PASSWORD,
//       },
//     });

//     const mailData = {
//       from: process.env.MAIL_ID,
//       to,
//       subject,
//       text,
//     };

//     await transporter.sendMail(mailData);
//     console.log(`Email sent to ${to}`);
//     return true;
//   } catch (error) {
//     console.error("Email sending failed:", error);
//     return false;
//   }
// };

// module.exports = { sendMail };
