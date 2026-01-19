const asyncHandler = require("express-async-handler");
// const crypto = require("../helpers/crypto");
const helper = require("../helpers/helpers");
const multer = require("multer");
const { generateToken, hashValue, compareValue, isEmail } = require("../helpers/helpers");
const userModel = require("../models/userModel");
const bcrypt = require("bcryptjs");
const { sendMail, sendEmail } = require("../helpers/mailer");
const crypto = require("crypto");
const { default: axios } = require("axios");
const dotenv = require("dotenv").config();
const twilio = require("twilio");
const fs = require("fs");

// Function to load logo for email templates
// const getLogoBase64 = () => {
//   try {
//     const logoPath = path.join(__dirname, '..', 'public', 'logo', '23.png');
//     console.log('Loading logo from:', logoPath);
//     if (fs.existsSync(logoPath)) {
//       const logoBuffer = fs.readFileSync(logoPath);
//       console.log('Logo loaded successfully, size:', logoBuffer.length, 'bytes');
//       return logoBuffer.toString('base64');
//     } else {
//       console.error('Logo file not found at:', logoPath);
//       return '';
//     }
//   } catch (err) {
//     console.error('Failed to load logo for email:', err.message);
//     return '';
//   }
// };
let logoBase64 = '';
try {
  logoBase64 = fs.readFileSync("public/logo/23.png").toString("base64");
} catch (err) {
  console.log('Logo file not found, using default');
}

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const signUpRequest = asyncHandler(async (req, res) => {
  const { name, email, phone,state, password, referredBy } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ message: "Please enter all fields" });
  }
  try {
    const userAvailable = await userModel.findOne({ email });
    const isMobileExist = await userModel.findOne({ phone });

    if (userAvailable) {
      res.status(400).json({ message: "Email-id already exists" });
    } 
    else if (isMobileExist) {
      res.status(400).json({ message: "Mobile already exists - Please try with another" });
    } 
    
    else {

      const hashedPassword = await bcrypt.hash(password, 12);
      const referralCode = helper.referral();
      const appId = helper.appId();

      const otp = helper.generateNumericOtp();
      const codeHash = await hashValue(otp);

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min


      console.log(email, otp, referralCode, appId);

      const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>Welcome to Precious Goldsmith</title>
        <style>
          @media only screen and (max-width: 600px) {
            .email-container {
              width: 100% !important;
              max-width: 100% !important;
            }
            .email-content {
              padding: 20px 15px !important;
            }
            .email-header {
              padding: 30px 20px !important;
            }
            .email-title {
              font-size: 22px !important;
            }
            .email-subtitle {
              font-size: 12px !important;
            }
            .otp-box {
              padding: 20px 15px !important;
            }
            .otp-code {
              font-size: 32px !important;
              letter-spacing: 8px !important;
              padding: 12px 20px !important;
            }
            .benefits-section {
              padding: 20px 15px !important;
            }
            .footer-content {
              padding: 20px 15px !important;
            }
            .footer-text {
              font-size: 10px !important;
            }
            table[class="responsive-table"] {
              width: 100% !important;
            }
            td[class="responsive-cell"] {
              display: block !important;
              width: 100% !important;
              text-align: left !important;
              padding: 10px 0 !important;
            }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 20px 10px;">
              <table role="presentation" class="email-container" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);">
                
                <!-- Header with Gold Gradient -->
                <tr>
                  <td class="email-header" style="background: linear-gradient(135deg, #f5f5f5 0%, #f5f5f5 100%); padding: 40px 30px; text-align: center;">
          ${logoBase64 ? `<img src="https://res.cloudinary.com/ddfnarfsb/image/upload/v1765179970/WhatsApp_Image_2025-11-26_at_6.14.48_PM-removebg-preview_euia6w.png" alt="Precious Goldsmith" style="width: 80px; max-width: 100%; height: auto; margin-bottom: 15px;"/>` : '<div style="font-size: 48px; font-weight: bold; color: #D4AF37; margin-bottom: 15px;">PG</div>'}
                    <h1 class="email-title" style="margin: 0; color: #333; font-size: 28px; font-weight: bold;">Precious Goldsmith</h1>
                    <p class="email-subtitle" style="margin: 10px 0 0; color: #555; font-size: 14px;">Digital Gold & Silver Investment Platform</p>
                  </td>
                </tr>

                <!-- Welcome Banner -->
                <tr>
                  <td style="background-color: #E9BE8C; padding: 25px 30px; text-align: center;">
                    <h2 style="margin: 0; color: #f5f5f5; font-size: 24px; font-weight: normal;">Welcome to the Precious Goldsmith Family!</h2>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td class="email-content" style="padding: 40px 30px;">
                    <p style="margin: 0 0 20px; color: #333; font-size: 18px; line-height: 1.6;">
                      Dear <strong style="color: #d4a574;">${name || "Valued Customer"}</strong>,
                    </p>
                    
                    <p style="margin: 0 0 25px; color: #555; font-size: 15px; line-height: 1.8;">
                      We are thrilled to welcome you to the <strong>Precious Goldsmith</strong> community! You are now part of an exclusive group of smart investors who trust us for their digital gold and silver investments.
                    </p>

                    <p style="margin: 0 0 25px; color: #555; font-size: 15px; line-height: 1.8;">
                      To complete your registration and start your golden journey with us, please verify your email using the OTP below:
                    </p>

                    <!-- OTP Box -->
                    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                      <tr>
                        <td align="center" style="padding: 0 10px;">
                          <div class="otp-box" style="background: linear-gradient(135deg, #f9f4ef 0%, #fff8f0 100%); border: 2px solid #E9BE8C; border-radius: 12px; padding: 30px; display: inline-block; max-width: 100%;">
                            <p style="margin: 0 0 10px; color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Your Verification Code</p>
                            <div class="otp-code" style="font-size: 42px; font-weight: bold; color: #333; letter-spacing: 12px; font-family: 'Courier New', monospace; background: #E9BE8C; padding: 15px 30px; border-radius: 8px; word-break: break-all;">
                              ${otp}
                            </div>
                            <p style="margin: 15px 0 0; color: #999; font-size: 12px;">
                              This code expires in <strong style="color: #d4a574;">10 minutes</strong>
                            </p>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Benefits Section -->
                    <div class="benefits-section" style="background: #f9f9f9; border-radius: 10px; padding: 25px; margin: 25px 0;">
                      <h3 style="margin: 0 0 20px; color: #333; font-size: 16px; border-bottom: 2px solid #E9BE8C; padding-bottom: 10px;">
                        Why Choose Precious Goldsmith?
                      </h3>
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #555; font-size: 14px;">
                            <span style="color: #E9BE8C; margin-right: 10px;">&#10003;</span> 100% Secure and Insured Digital Gold
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #555; font-size: 14px;">
                            <span style="color: #E9BE8C; margin-right: 10px;">&#10003;</span> Buy Gold Starting from Just Rs.1
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #555; font-size: 14px;">
                            <span style="color: #E9BE8C; margin-right: 10px;">&#10003;</span> Convert to Physical Gold Anytime
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #555; font-size: 14px;">
                            <span style="color: #E9BE8C; margin-right: 10px;">&#10003;</span> Real-time Market Prices
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #555; font-size: 14px;">
                            <span style="color: #E9BE8C; margin-right: 10px;">&#10003;</span> Instant Sell and Withdraw
                          </td>
                        </tr>
                      </table>
                    </div>

                    <p style="margin: 20px 0 0; color: #888; font-size: 13px; line-height: 1.6; font-style: italic;">
                      <strong>Note:</strong> If you did not request this code, please ignore this email. Your account security is our top priority.
                    </p>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding: 0 30px;">
                    <div style="border-top: 1px solid #eee;"></div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td class="footer-content" style="padding: 30px; text-align: center; background: #fafafa;">
                    <p style="margin: 0 0 15px; color: #333; font-size: 14px; font-weight: bold;">
                      Start Building Your Golden Future Today!
                    </p>
                    <p style="margin: 0 0 10px; color: #888; font-size: 12px;">
                      Questions? Contact us at <a href="mailto:support@preciousgoldsmith.com" style="color: #d4a574; text-decoration: none;">support@preciousgoldsmith.com</a>
                    </p>
                    <p class="footer-text" style="margin: 0; color: #aaa; font-size: 11px;">
                      Precious Goldsmith | KSAN Industries LLP<br>
                      New No:46, Old No:70/1, Bazullah Road, T Nagar, Chennai - 600017
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

      // Try to send email, but don't fail registration if email fails
      try {
        await sendEmail(email, "Welcome to Precious Goldsmith - Verify Your Account", htmlContent, name);
        console.log('✅ Email sent successfully to:', email);
      } catch (emailError) {
        console.error('❌ Email sending failed:', emailError.message);
        console.log('⚠️  Continuing with user registration despite email failure...');
        // Don't throw error - continue with registration
      }
      
      // Find referring user if referral code provided
      let referringUser = null;
      if (referredBy) {
        referringUser = await userModel.findOne({ referralCode: referredBy });
        if (!referringUser) {
          return res.status(400).json({ message: "Invalid referral code" });
        }
      }

      const user = await userModel.create({
        name,
        email,
        state,
        otp: { codeHash, expiresAt },
        referralCode: referralCode,
        referredBy: referringUser ? referringUser._id : null,
        referralPoints: 0,
        referralCount: 0,
        kycVerified: false,
        referralRewardGiven: false,
        appId: appId,
        phone,
        password: hashedPassword,
      });

      if (user) {
        res.status(200).json({
          status: true,
          message: "We have sent otp your email to verify it",
          data: {
            _id: user._id,
            name: user.name,
            email: user.email,
          },
        });
      } else {
        res.status(400).json({ message: "failed - please try again" });
      }
    }


  } catch (error) {
    res.status(400).json({ message: "failed - please try again" });

    console.log("err signup: ", error);
  }
});

const signInRequest = asyncHandler(async (req, res) => {
  console.log(req.headers);

  const { email, password } = req.body;
  console.log(req.body);
  console.log(email, password);

  if (!email || !password) {
    res.status(400).json({ status:false,message: "Please enter all fields" });
  }
  const user = await userModel.findOne({ email });

  if (!user) {
    res.status(400).json({ status:false,message: "User not found" });
  }
  const userAvailable = await bcrypt.compare(password, user.password);
  if (!userAvailable) {
    res.status(400).json({ status:false,message: "Invalid password" });
    return;
  }
  console.log("approved");

  user.lastLogin = new Date();
  await user.save();
  const accessToken = generateToken({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });

  res.status(200).json({
    status: "success",
    token: accessToken,
  });
});

const mail = async (req, res) => {
  try {
    const data = sendMail(req.body.to, req.body.subject, req.body.text);
    if (data == true)
      res.status(200).json({ message: "successfully send mail" });
    if (data == false) res.status(404).json({ message: "Failed to send mail" });
  } catch (error) {
    res.status(404).json({ message: "failed", err: error });
  }
};

// Forgot Password Request
const SendOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;
  console.log("Forgot Password Request for:", email);
  if (!email) {
    res.status(400);
    throw new Error("Email is required");
  }

  try {
    const user = await userModel.findOne({ email });

    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    // Generate OTP
    const otp = helper.generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
    console.log("OTP:", otp, "Expiry:", otpExpiry);
    // Send Email
    const htmlContent = `
      <h2>Password Reset OTP</h2>
      <p>Dear ${user.name || "User"},</p>
      <p>Your OTP for password reset is: <strong>${otp}</strong></p>
      <p>This code will expire in 10 minutes.</p>
    `;

    await sendEmail(email, "Password Reset OTP", htmlContent, user.name);

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    res.status(200).json({
      status: true,
      message: "OTP sent to your email for password reset",
    });
  } catch (error) {
    console.error("Error in forgot password:", error);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});



const verifyPan = asyncHandler(async (req, res) => {
  const { pan, name } = req.body;
  if (!name || !name) {
    res.status(400).json({ message: "Please provide all fields" });
  }
  try {
    const user = await userModel.findById(req.user.id);
    console.log("user", user);
    if (!user) {
      res.status(404).json({ message: "User not found" });
    }


       const alreadyVerified = user.panVerified ==true

  if (alreadyVerified) {
    return res.status(201).json({
      status: false,
      message: "Pan Number already verified",
    });
  }
    const response = await axios.post(
      'https://api.cashfree.com/verification/pan',
      { pan, name },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': process.env.PAN_ID,
          'x-client-secret': process.env.PAN_SECRET,
        },
      }
    );
    console.log(response.data, response.status, "response.status");
    if (response.status == 200) {
      if (response.data.valid == true) {
        const wasKycVerified = user.kycVerified;
        
        user.panDetails = response.data;
        user.panVerified = response.data.valid;
        // Mark KYC as verified when PAN is verified
        user.kycVerified = true;
        
        // Process referral rewards if KYC is just completed and user was referred
        if (!wasKycVerified && user.referredBy && !user.referralRewardGiven) {
          try {
            // Give 50 points to the new user
            user.referralPoints = (user.referralPoints || 0) + 50;
            user.referralRewardGiven = true;
            
            // Give 25 points to the referring user and increment their referral count
            const referringUser = await userModel.findById(user.referredBy);
            if (referringUser) {
              referringUser.referralPoints = (referringUser.referralPoints || 0) + 25;
              referringUser.referralCount = (referringUser.referralCount || 0) + 1;
              await referringUser.save();
              
              console.log(`Referral reward processed: New user ${user.email} got 50 points, Referring user ${referringUser.email} got 25 points`);
            }
          } catch (referralError) {
            console.error('Error processing referral rewards:', referralError);
            // Don't fail PAN verification if referral processing fails
          }
        }
        
        await user.save();
        res.status(200).json({
          status: true,
          message: "PAN verified successfully",
          details: response.data,
          referralReward: user.referralRewardGiven ? {
            newUserPoints: 50,
            referringUserPoints: 25
          } : null
        });
      } else {
        res.status(203).json({
          status: false,
          message: "Invalid PAN CARD information ",
          details: response.data
        });
      }


    } else {
      res.status(203).json({
        status: false,
        message: "something went wrong",
      });
    }
  } catch (err) {

    console.error(err.response?.data || err.message);
    res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });

  }
});

const verifyBankAccount = asyncHandler(async (req, res) => {
  const { bank_account, ifsc,name } = req.body;
  console.log(bank_account, ifsc, "verifyBankAccount");
  if (!bank_account || !ifsc) {
    res.status(400).json({ message: "Please provide all fields" });
  }

 
  try {
    const user = await userModel.findById(req.user.id);
    console.log("user", user);
    if (!user) {
      res.status(404).json({ message: "User not found" });
    }

      const alreadyExists = user.bankDetails.some(
    (detail) =>
      detail.account_number === bank_account
  );

  if (alreadyExists) {
    return res.status(201).json({
      status: false,
      message: "Bank account already added",
    });
  }

    const payload = {
      bank_account,
      ifsc,
      name
    };

    const response = await axios.post(
      `https://api.cashfree.com/verification/bank-account/sync`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "x-client-id": process.env.PAN_ID,
          "x-client-secret": process.env.PAN_SECRET,
          "x-api-version": "2022-09-01"
        }
      }
    );



    console.log(response.data, response.status, "response.status");
    if (response.status == 200) {

      if (response.data.account_status == "VALID") {
        // if (response.data.status == true) {
        // user.bankDetails.push(user.bankDetails.account_number = bank_account, response.data);
        user.bankDetails.push({
          reference_id: response.data.reference_id,
          name_at_bank: response.data.name_at_bank,
          account_number: bank_account,
          bank_name: response.data.bank_name,
          city: response.data.city,
          micr: response.data.micr,
          branch: response.data.branch,
          account_status: response.data.account_status,
          account_status_code: response.data.account_status_code,
          ifsc_details: response.data.ifsc_details,
        });
        // user.panVerified = response.data.valid;
        await user.save();
        res.status(200).json({
          status: true,
          message: "Bank Account verified successfully",
          details: response.data
        });
      } else {
        res.status(203).json({
          status: false,
          message: "Invalid Bank Account failed ",
          details: response.data
        });
      }


    } else {
      res.json({
        status: false,
        message: "something went wrong",
      });
    }
  } catch (err) {

    console.error(err.response?.data || err.message);
    res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });

  }
});

const forgotPasswordRequest = asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;
    console.log("mm", email);
    const user = await userModel.findOne({ email });

    // if (!isEmail(email)) return res.status(400).json({ message: 'Invalid email' });
    if (user) {


      const otp = helper.generateNumericOtp();
      const codeHash = await hashValue(otp);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
      console.log(otp,
        codeHash,
        expiresAt)
      user.otp = { codeHash, expiresAt };
      user.resetToken = null;
      await user.save();

      console.log("email,otp", email, otp);
      await sendEmail(
        email,
        "Your OTP Code",
        `<h2>Your OTP is: <b>${otp}</b></h2><p>Valid for 5 minutes</p>`,
        user.name
      );

      return res.json({ message: `Hi ${user.name} OTP has been sent to registered mail id .` });
    }
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: "Error in forgot password", error: e });
  }
});
const verifyOtp = asyncHandler(async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    if (!isEmail(email) || !otp) return res.status(400).json({ message: 'Invalid payload' });

    const user = await userModel.findOne({ email });

    if (user) {

      if (!user || !user.otp?.codeHash || !user.otp?.expiresAt) {
        return res.status(400).json({ message: 'Invalid or expired OTP' });
      }

      if (user.otp.expiresAt < new Date()) {
        user.otp = null;
        await user.save();
        return res.status(400).json({ message: 'Expired OTP' });
      }

      const ok = await compareValue(otp, user.otp.codeHash);
      if (!ok) return res.status(400).json({ message: 'Invalid  OTP' });

      // OTP valid → issue a reset token and clear OTP
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min
      user.resetToken = { token, expiresAt };
      user.otp = undefined;
      await user.save();

      return res.json({ resetToken: token, expiresInMinutes: 15 });
    } else {
      res.status(400).json({ message: "User can't found" });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});
const activateAccount = asyncHandler(async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    if (!isEmail(email) || !otp) return res.status(400).json({ message: 'Invalid payload' });

    const user = await userModel.findOne({ email });

    if (user) {
      console.log("user", user)
      if (!user || !user.otp?.codeHash || !user.otp?.expiresAt) {
        return res.status(400).json({ message: 'Invalid or expired OTP' });
      }

      if (user.otp.expiresAt < new Date()) {
        user.otp = null;
        await user.save();
        return res.status(400).json({ message: 'Expired OTP' });
      }

      const ok = await compareValue(otp, user.otp.codeHash);
      if (!ok) return res.status(400).json({ message: 'Invalid  OTP' });

      user.activeAccount = true;
      await user.save();
      const accessToken = generateToken({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });


      return res.status(200).json({
        status: "success",
        message: "account activated",
        token: accessToken,
      });
    } else {
      res.status(400).json({ message: "User can't found" });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});

const updatePassword = asyncHandler(async (req, res) => {
  try {
    const { email, resetToken, newPassword } = req.body || {};
    if (!isEmail(email) || !resetToken) {
      return res.status(400).json({ message: 'Invalid payload' });
    }

    const user = await userModel.findOne({ email });

    if (user) {

      console.log(user);
      if (!user || !user.resetToken?.token || !user.resetToken?.expiresAt) {
        return res.status(400).json({ message: 'Invalid or expired token' });
      }

      if (user.resetToken.expiresAt < new Date()) {
        user.resetToken = undefined;
        await user.save();
        return res.status(400).json({ message: 'Expired token' });
      }

      if (user.resetToken.token !== resetToken) {
        return res.status(400).json({ message: 'Invalid or expired token' });
      }

      console.log("password", newPassword);

      console.log("bf password", user.password);
      const passwordHash = await bcrypt.hash(newPassword, 12);

      console.log("af passwordHash", passwordHash);
      user.password = passwordHash;
      user.passwordChangedAt = new Date();
      user.resetToken = null; // consume token
      await user.save();
      console.log("user", user);

      return res.json({ message: 'Password reset successful' });
    } else {
      res.status(400).json({ message: "User can't found" });

    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});

const OTP_REQUEST_LIMIT = 3; // max 3 OTPs in 15 minutes
const OTP_WINDOW = 15 * 60 * 1000; // 15 mins in ms

const sendMobileOtp = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Phone is required" });

  const otp = helper.generateOTP(); // e.g., 6-digit number
  const codeHash = crypto.createHash("sha256").update(otp).digest("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
console.log(otp,codeHash,expiresAt);
  // find the user by phone
  let user = await userModel.findOne({ phone });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Initialize `mobileOtp` if not present
  if (!user.mobileOtp) {
    user.mobileOtp = {};
  }

  const now = Date.now();

  // reset window if older than 15 mins
  if (
    !user.mobileOtp.lastSentAt ||
    now - new Date(user.mobileOtp.lastSentAt).getTime() > OTP_WINDOW
  ) {
    user.mobileOtp.requestCount = 0;
  }

  if (user.mobileOtp.requestCount >= OTP_REQUEST_LIMIT) {
    return res.status(429).json({
      error: `Too many OTP requests. Please try again after 15 minutes.`,
    });
  }

  // update otp details
  user.mobileOtp.codeHash = codeHash;
  user.mobileOtp.expiresAt = expiresAt;
  user.mobileOtp.lastSentAt = new Date();
  user.mobileOtp.attempts = 0; // reset attempts
  user.mobileOtp.requestCount = (user.mobileOtp.requestCount || 0) + 1;

  await user.save();

  try {
    await client.messages.create({
      body: `Your OTP is ${otp}. It expires in 5 minutes. - Precious Goldsmith`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone.startsWith("+") ? phone : `+91${phone}`,
    });

    return res.json({ success: true, message: "OTP sent successfully" });
  } catch (err) {
    console.error("❌ SMS failed:", err.message);
    return res.status(500).json({ error: "Failed to send OTP" ,message:err});
  }
});



const MAX_ATTEMPTS = 3;


const verifyMobileOtp = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: "Phone & OTP required" });
  }

  const user = await userModel.findOne({ phone });
  if (!user || !user.mobileOtp) {
    return res.status(400).json({ error: "OTP not found" });
  }

  const { codeHash, expiresAt, attempts } = user.mobileOtp;

  // check attempts
  if (attempts >= MAX_ATTEMPTS) {
    return res
      .status(403)
      .json({ error: "Too many failed attempts. Request a new OTP." });
  }

  // check expiry
  if (expiresAt < new Date()) {
    return res.status(400).json({ error: "OTP expired" });
  }

  const inputHash = crypto.createHash("sha256").update(otp).digest("hex");

  if (codeHash !== inputHash) {
    user.mobileOtp.attempts += 1;
    await user.save();
    return res.status(400).json({ error: "Invalid OTP" });
  }

  // ✅ OTP success → clear OTP data
  user.mobileOtp = undefined;
  user.mobileVerified = true; // optional: mark account active after verification
  await user.save();

  return res.json({ success: true, message: "OTP verified successfully" });
});



// const adminSignUpRequest = async (req, res) => {
//     const { name, email, password } = req.body;

//     try {
//         if (!name || !email || !password) return res.status(403).json({ status: false, message: "All fields must be provided" });
//         const adminExist = await adminModel.findOne({ email })
//         if (adminExist) {
//             res.status(400);
//             throw new Error("Admin already exists");
//         } else {
//             const hashedPassword = await bcrypt.hash(password, 10);
//             const admin = await adminModel.create({ name, email, hashedPassword });

//             res.status(200).json({ status: true, message: "Created successfully", details: admin });

//         }
//     } catch (error) {

//         res.status(400).json({ message: error.message });
//         // throw Error();

//     }

// }

module.exports = {
  signUpRequest,
  signInRequest,
  verifyPan,
  verifyOtp, updatePassword, activateAccount, verifyBankAccount,
  SendOTP,
  mail, forgotPasswordRequest,sendMobileOtp,verifyMobileOtp
  // adminSignInRequest
};
