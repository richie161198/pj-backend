
// const nodemailer = require("nodemailer");


// const sendMail = (to, subject, text) => {
//     console.log(process.env.MAIL_ID,
// process.env.MAIL_PASSWORD,process.env.SMTP,
// process.env.MAIL_PORT)
//     try {
//         const transporter = nodemailer.createTransport({
//             host: process.env.SMTP,
//             port: process.env.MAIL_PORT,
//             auth: {
//                 user: process.env.MAIL_ID,
//                 pass: process.env.MAIL_PASSWORD,
//             }, secure: false
//         })
//         const mailData = ({
//             from: process.env.MAIL_ID,
//             to: to,
//             subject: subject,
//             text: text,
//         })
//         transporter.sendMail(mailData,
//             // (err, data) => {
//             //     if (err) return false
//             //     if (data) return true
//             // }
//         )
//         return true;
//     } catch (error) {

//         console.log(error);
//         return false;
//     }

// }

// module.exports = { sendMail }

// mailer.js
const SibApiV3Sdk = require('sib-api-v3-sdk');

let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.SENDINBLUE_API; 

let apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();


async function sendEmail(toEmail, subject, htmlContent, toName = '') {
  try {
    const sendSmtpEmail = {
      to: [{ email: toEmail, name: toName }],
      sender: { email: 'preciousconsole@gmail.com', name: 'Precious Goldsmith' }, // Replace with verified sender
      subject,
      htmlContent
    };
    return await apiInstance.sendTransacEmail(sendSmtpEmail);
  } catch (error) {
    console.error('Send Email Error:', error);
    throw new Error('Failed to send email');
  }
}

module.exports = {sendEmail};
