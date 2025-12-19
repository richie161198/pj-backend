const axios = require('axios');
const crypto = require('crypto');

/**
 * BMC (Blue Mountain Courier) API Integration Service
 * 
 * API Endpoints:
 * - Order Upload: Create shipment orders
 * - Docket Track: Track shipments
 * - Pincode Check: Validate delivery pincode
 * - Docket Cancel: Cancel shipments
 * - Reverse Shipment: Return shipments
 */

class BMCService {
  constructor() {
    // BMC API Credentials - Add these to your .env file
    this.apiKey = process.env.BMC_API_KEY || 'YOUR_BMC_API_KEY';
    this.apiSecret = process.env.BMC_API_SECRET || 'YOUR_BMC_SECRET';
    this.apiUrl = process.env.BMC_API_URL || 'https://api.bluemountain.in';
    this.clientId = process.env.BMC_CLIENT_ID || 'CC000700340';

    // Default pickup address - Configure as per your warehouse
    this.pickupAddress = {
      name: process.env.BMC_PICKUP_NAME || 'Precious Goldsmiths Warehouse',
      address: process.env.BMC_PICKUP_ADDRESS || 'No. 123, Industrial Area, chennai, Tamil Nadu 600091',
      city: process.env.BMC_PICKUP_CITY || 'Chennai',
      state: process.env.BMC_PICKUP_STATE || 'Tamil Nadu',
      pincode: process.env.BMC_PICKUP_PINCODE || '600091',
      phone: process.env.BMC_PICKUP_PHONE || '7092053592',
      email: process.env.BMC_PICKUP_EMAIL || 'warehouse@preciousgoldsmith.com',
    };
  }

  /**
   * Generate authentication token for BMC API
   */
  generateAuthToken() {
    const timestamp = new Date().getTime();
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(`${this.clientId}${timestamp}`)
      .digest('hex');

    return {
      'X-Client-Id': this.clientId,
      'X-Timestamp': timestamp.toString(),
      'X-Signature': signature,
      'Content-Type': 'application/json',
    };
  }

  // /**
  //  * Create Shipment Order (Order Upload API)
  //  * 
  //  * @param {Object} orderData - Order details
  //  * @returns {Promise<Object>} BMC Response with AWB number
  //  */
  // async createShipment(orderData) {
  //   try {
  //     const {
  //       orderId,
  //       orderCode,
  //       customerName,
  //       customerPhone,
  //       customerEmail,
  //       deliveryAddress,
  //       items,
  //       totalAmount,
  //       codAmount = 0,
  //       weight = 0.5,
  //       packageCount = 1,
  //     } = orderData;

  //     // Prepare BMC Order Upload payload
  //     const payload = {
  //       clientId: this.clientId,
  //       orderNo: orderCode || orderId,
  //       orderDate: new Date().toISOString().split('T')[0],

  //       // Pickup Details
  //       pickupName: this.pickupAddress.name,
  //       pickupAddress: this.pickupAddress.address,
  //       pickupCity: this.pickupAddress.city,
  //       pickupState: this.pickupAddress.state,
  //       pickupPincode: this.pickupAddress.pincode,
  //       pickupPhone: this.pickupAddress.phone,
  //       pickupEmail: this.pickupAddress.email,

  //       // Delivery Details
  //       deliveryName: customerName,
  //       deliveryAddress: deliveryAddress.addressLine1 || deliveryAddress,
  //       deliveryAddress2: deliveryAddress.addressLine2 || '',
  //       deliveryCity: deliveryAddress.city || 'N/A',
  //       deliveryState: deliveryAddress.state || 'N/A',
  //       deliveryPincode: deliveryAddress.pincode || '000000',
  //       deliveryPhone: customerPhone,
  //       deliveryEmail: customerEmail || '',

  //       // Shipment Details
  //       productName: items && items.length > 0 ? items[0].name : 'Product',
  //       productDescription: `Order ${orderCode} - ${items?.length || 0} items`,
  //       weight: weight, // in kg
  //       length: 20, // in cm
  //       breadth: 15,
  //       height: 10,
  //       packageCount: packageCount,

  //       // Payment Details
  //       paymentMode: codAmount > 0 ? 'COD' : 'PREPAID',
  //       codAmount: codAmount,
  //       invoiceAmount: totalAmount,

  //       // Additional Details
  //       deliveryType: 'FORWARD',
  //       serviceType: 'STANDARD',
  //       returnRequired: false,
  //     };

  //     console.log('📦 Creating BMC Shipment:', orderCode);

  //     const response = await axios.post(
  //       `${this.apiUrl}/api/v1/order/upload`,
  //       payload,
  //       { headers: this.generateAuthToken() }
  //     );

  //     if (response.data && response.data.success) {
  //       console.log('✅ BMC Shipment Created:', response.data.data.awbNumber);
  //       return {
  //         success: true,
  //         awbNumber: response.data.data.awbNumber,
  //         trackingNumber: response.data.data.awbNumber,
  //         courierName: 'Blue Mountain Courier',
  //         estimatedDeliveryDate: response.data.data.estimatedDeliveryDate,
  //         pickupScheduled: response.data.data.pickupScheduled,
  //         bmcResponse: response.data,
  //       };
  //     } else {
  //       throw new Error(response.data.message || 'Failed to create shipment');
  //     }
  //   } catch (error) {
  //     console.error('❌ BMC Shipment Creation Error:', error.message);

  //     // Return fallback response for development
  //     if (process.env.NODE_ENV === 'development') {
  //       console.log('⚠️ Using fallback tracking number for development');
  //       return {
  //         success: false,
  //         awbNumber: `DEV-${Date.now()}`,
  //         trackingNumber: `DEV-${Date.now()}`,
  //         courierName: 'Blue Mountain Courier',
  //         error: error.message,
  //         isDevelopmentMode: true,
  //       };
  //     }

  //     throw error;
  //   }
  // }


  // async createShipment(orderData) {
  //   console.log("📦 Creating BVC Shipment: createShipmen", orderData);
  //   try {
  //     const {
  //       orderId,
  //       orderCode,
  //       customerName,
  //       customerPhone,
  //       customerEmail,
  //       deliveryAddress,
  //       items,
  //       totalAmount,
  //       codAmount = 0,
  //       weight = 0.5,
  //       packageCount = 1,
  //     } = orderData;


  //     // 2️⃣ Build payload as per spec
  //     const payload = {
  //       CustomerId: this.clientId, // e.g. "10001"
  //       OrderUploadData: [
  //         {
  //           OrderNo: orderCode,
  //           AgentID: "KSAN0001",
  //           ProductCode: items[0]?.name || "Product",
  //           ItemName: items[0]?.name || "Item",
  //           AWBNo: `PG${Date.now()}`.slice(0, 9), // must be 9 chars
  //           No_Of_Pieces: packageCount,
  //           CustomerName: customerName,
  //           CustomerAdd1: deliveryAddress.addressLine1 || "N/A",
  //           CustomerAdd2: deliveryAddress.addressLine2 || "",
  //           CustomerCity: deliveryAddress.city || "N/A",
  //           CustomerState: deliveryAddress.state || "N/A",
  //           CustomerPincode: deliveryAddress.pincode || "000000",
  //           CustomerTeleNo: customerPhone || "0000000000",
  //           CustomerMobileNo: customerPhone || "0000000000",
  //           TotalAmt: totalAmount,
  //           PaymentMode:  "P",
  //           CollectableAmt: codAmount,
  //           Weight: weight,
  //           UOM: "Per KG",
  //           ServiceType: "Express",
  //         },
  //       ],
  //     };
  //     console.log({ "BVC Payload": payload
  //     });
  //     const response = await axios.post(
  //       'https://bvcmars.com/RestService/OrderUploadService.svc/PushOrderUpload',
  //       payload,
  //       {
  //         headers: {
  //           // "XX-Authentication-Token": XXAuthenticationToken,
  //           // "TimeStamp": TimeStamp,
  //           "Content-Type": "application/json",
  //           "XXAuthenticationToken": "oOwCZ4oD/y8OFyG4H1y6AoQ7UxGFJwZLCaKvAk5a5MdxT0YlUaIFUTfC4pS/XQXU43HCRXZIr7bWNNuC/PKbAHrd7wQCEXYs2ZI+Sr1Fvunxa7U6NnnJzaHYPdmHHjpv",
  //           "TimeStamp": "202510131455560291",
  //           // "CustomerPublicKey": "174EE6D5-B9FB-482B-AA1B-1378673661A2"
  //           'Cookie':
  //             'ASP.NET_SessionId=yphl1cbzbhjpgpcyydtaymkb; ASP.NET_SessionId=mrnbwddzkztglhcm4bxqughr; ASP.NET_SessionId=su4uzueolzmrskhnzwadxaqy',

  //         },
  //       }
  //     );

  //     console.log("✅ BVC Shipment Created:", response.data);

  //     // 4️⃣ Handle success
  //     const uploadResult = response.data?.OrderUploadResult?.[0] || {};
  //     if (uploadResult.Succeed) {
  //       console.log("✅ BVC Shipment Created Successfully:", uploadResult.DockNo);
  //       return {
  //         success: true,
  //         awbNumber: uploadResult.DockNo,
  //         trackingNumber: uploadResult.DockNo,
  //         courierName: "BVC Logistics",
  //       };
  //     } else {
  //       throw new Error(uploadResult.Reason || "BVC Upload failed");
  //     }
  //   } catch (error) {
  //     console.error("❌ BVC Shipment Creation Error:", error.message);

  //     // fallback for dev
  //     return {
  //       success: false,
  //       awbNumber: `PG${Date.now()}`.slice(0, 9),
  //       trackingNumber: `DEV-${Date.now()}`,
  //       courierName: "BVC Logistics",
  //       error: error.message,
  //     };
  //   }
  // }

    async createShipment(orderData) {
    console.log("📦 Creating BVC Shipment: createShipmen", orderData);
    try {
      const {
        orderId,
        orderCode,
        customerName,
        customerPhone,
        customerEmail,
        deliveryAddress,
        items,
        totalAmount,
        codAmount = 0,
        weight ,
        packageCount = 1,
      } = orderData;


      
      const payload = {
        CustomerId: this.clientId, // e.g. "10001"
        OrderUploadData: [
          {
            OrderNo: orderCode,
            AgentID: "KSAN0001",
            ProductCode: items[0]?.name || "Product",
            ItemName: items[0]?.name || "Item",
            AWBNo: `PG${Date.now()}`.slice(0, 9), // must be 9 chars
            No_Of_Pieces: packageCount,
            CustomerName: customerName,
            CustomerAdd1: deliveryAddress.addressLine1 || "N/A",
            CustomerAdd2: deliveryAddress.addressLine2 || "",
            CustomerCity: deliveryAddress.city || "N/A",
            CustomerState: deliveryAddress.state || "N/A",
            CustomerPincode: deliveryAddress.pincode || "000000",
            CustomerTeleNo: customerPhone || "0000000000",
            CustomerMobileNo: customerPhone || "0000000000",
            TotalAmt: totalAmount,
            PaymentMode: codAmount > 0 ? "C" : "P",
            CollectableAmt: codAmount,
            Weight: weight,
            UOM: "Per KG",
            ServiceType: "Express",
          },
        ],
      };

//       const payload={
//     "CustomerId": "CC000700340",
//     "OrderUploadData": [
//         {
//             "OrderNo": "PJ1611788001",
//             "AgentID": "KSAN0001",
//             "ProductCode": "1gm Gold coin",
//             "ItemName": "1gm Gold coin",
//             "AWBNo": "281125559001",
//             "No_Of_Pieces": 1,
//             "CustomerName": "Chandran J",
//             "CustomerAdd1": "No.10 new street Iyappan nagar Madipakkam",
//             "CustomerCity": "Chennai",
//             "CustomerState": "Tamil Nadu",
//             "CustomerPincode": "600091",
//             "CustomerTeleNo": "7092053592",
//             "CustomerMobileNo": "7092053592",
//             "TotalAmt": 10000,
//             "PaymentMode": "P",
//             "CollectableAmt": 0,
//             "Weight": 0.001,
//             "UOM": "Per KG",
//             "ServiceType": "Express"
//         }
//     ]
// }
      console.log({ "BVC Payload": payload.OrderUploadData
      });
      // const response = await axios.post(
      //   'https://bvcmars.com/RestService/OrderUploadService.svc/PushOrderUpload',
      //   payload,
      //   {
      //     headers: {
      //       // "XX-Authentication-Token": XXAuthenticationToken,
      //       // "TimeStamp": TimeStamp,
      //       "Content-Type": "application/json",
      //       "XXAuthenticationToken": "oOwCZ4oD/y8OFyG4H1y6AoQ7UxGFJwZLCaKvAk5a5MdxT0YlUaIFUTfC4pS/XQXU43HCRXZIr7bWNNuC/PKbAHrd7wQCEXYs2ZI+Sr1Fvunxa7U6NnnJzaHYPdmHHjpv",
      //       "TimeStamp": "202510131455560291",
      //       // "CustomerPublicKey": "174EE6D5-B9FB-482B-AA1B-1378673661A2"
      //       'Cookie':
      //         'ASP.NET_SessionId=yphl1cbzbhjpgpcyydtaymkb; ASP.NET_SessionId=mrnbwddzkztglhcm4bxqughr; ASP.NET_SessionId=su4uzueolzmrskhnzwadxaqy',

      //     },
      //   }
      // );

      const response = await axios.post(
  "https://bvcmars.com/RestService/OrderUploadService.svc/PushOrderUpload",
  payload,
  {
    headers: {
      "Content-Type": "application/json",
      "TimeStamp": "202510131455560291",
      "XX-Authentication-Token":
        "oOwCZ4oD/y8OFyG4H1y6AoQ7UxGFJwZLCaKvAk5a5MdxT0YlUaIFUTfC4pS/XQXU43HCRXZIr7bWNNuC/PKbAHrd7wQCEXYs2ZI+Sr1Fvunxa7U6NnnJzaHYPdmHHjpv",

      // REMOVE cookie unless really required
      // 'Cookie': 'ASP.NET_SessionId=xxx'
    },
  }
);

console.log("Result:", response.data);


      console.log("✅ BVC Shipment Created:", response.data);

      // 4️⃣ Handle success
      const uploadResult = response.data?.OrderUploadResult?.[0] || {};
      if (uploadResult.Succeed) {
        console.log("✅ BVC Shipment Created Successfully:", uploadResult.DockNo);
        return {
          success: true,
          awbNumber: uploadResult.DockNo,
          trackingNumber: uploadResult.DockNo,
          courierName: "BVC Logistics",
        };
      } else {
        throw new Error(uploadResult.Reason || "BVC Upload failed");
      }
    } catch (error) {
      console.error("❌ BVC Shipment Creation Error:", error);

      // Return error response instead of throwing to allow graceful handling
      return {
        success: false,
        awbNumber: `PG${Date.now()}`.slice(0, 9),
        trackingNumber: `DEV-${Date.now()}`,
        courierName: "BVC Logistics",
        error: error.message || "BVC Upload failed",
      };
    }
  }


  /**
   * Track Shipment (Docket Track API)
   * 
   * @param {String} awbNumber - AWB/Tracking number
   * @returns {Promise<Object>} Tracking details
   */
  async trackShipment(awbNumber) {
    try {
      const response = await axios.post(
        `${this.apiUrl}/api/v1/docket/track`,
        {
          clientId: this.clientId,
          awbNumbers: [awbNumber],
        },
        { headers: this.generateAuthToken() }
      );

      if (response.data && response.data.success) {
        const trackingData = response.data.data[0];

        return {
          success: true,
          awbNumber: trackingData.awbNumber,
          status: this.mapBMCStatus(trackingData.status),
          currentLocation: trackingData.currentLocation,
          deliveryDate: trackingData.deliveryDate,
          trackingHistory: trackingData.scanDetails.map(scan => ({
            status: this.mapBMCStatus(scan.status),
            location: scan.location,
            description: scan.description,
            timestamp: scan.scanDate,
            updatedBy: 'BMC System',
          })),
        };
      } else {
        throw new Error('Tracking data not found');
      }
    } catch (error) {
      console.error('❌ BMC Tracking Error:', error.message);
      throw error;
    }
  }

  /**
   * Track shipment using the BVC Tracking API described in bvc shippment requirement.
   * This uses the legacy `GetDocketTrackingDetails` endpoint.
   *
   * @param {String} docketNumber
   * @returns {Promise<Object>} Normalized tracking details
   */
  async trackBVCDocket(docketNumber) {
    try {
      if (!docketNumber) {
        throw new Error('Docket / tracking number is required');
      }

      const headers = {
        'Content-Type': 'application/json',
        TimeStamp: process.env.BVC_TRACK_TIMESTAMP || '202510131455560291',
        'XX-Authentication-Token':
          process.env.BVC_TRACK_TOKEN ||
          'oOwCZ4oD/y8OFyG4H1y6AoQ7UxGFJwZLCaKvAk5a5MdxT0YlUaIFUTfC4pS/XQXU43HCRXZIr7bWNNuC/PKbAHrd7wQCEXYs2ZI+Sr1Fvunxa7U6NnnJzaHYPdmHHjpv',
        Cookie:
          process.env.BVC_TRACK_COOKIE ||
          'ASP.NET_SessionId=yphl1cbzbhjpgpcyydtaymkb; ASP.NET_SessionId=mrnbwddzkztglhcm4bxqughr; ASP.NET_SessionId=su4uzueolzmrskhnzwadxaqy',
      };

      const response = await axios.post(
        'https://bvcmars.com/RestService/TrackingService.svc/GetDocketTrackingDetails',
        { DocketNo: docketNumber },
        { headers }
      );

      const data = response.data || {};

      if (data.Success === false) {
        throw new Error(data.Message || 'BVC tracking failed');
      }

      const rawHistory =
        data.TrackingDetails ||
        data.TrackingData ||
        data.OrderTrackingDetails ||
        data.DocketTrackingDetails ||
        data.data ||
        [];

      const historyArray = Array.isArray(rawHistory)
        ? rawHistory
        : Object.values(rawHistory);

      const normalizedHistory = historyArray
        .map((entry) => {
          const code =
            entry?.TrackingCode ||
            entry?.TrackingStatus ||
            entry?.StatusCode ||
            entry?.Code ||
            '';
          return {
            code,
            description:
              entry?.Description ||
              entry?.Remarks ||
              entry?.StatusText ||
              '',
            location: entry?.Location || entry?.BranchName || '',
            timestamp:
              entry?.EventDate ||
              entry?.TrackingDate ||
              entry?.Date ||
              entry?.UpdatedOn ||
              new Date().toISOString(),
            raw: entry,
          };
        })
        .filter((entry) => !!entry.code);

      const latest = normalizedHistory.length
        ? normalizedHistory[normalizedHistory.length - 1]
        : null;

      return {
        success: true,
        statusCode: latest?.code || null,
        statusDescription: latest?.description || null,
        history: normalizedHistory,
        raw: data,
      };
    } catch (error) {
      console.error('❌ BVC Tracking API error:', error.message);
      throw error;
    }
  }

  /**
   * Check Pincode Serviceability
   * 
   * @param {String} pincode - Delivery pincode
   * @returns {Promise<Object>} Serviceability details
   */
  async checkPincode(pincode) {
    try {
      const response = await axios.post(
        `${this.apiUrl}/api/v1/pincode/check`,
        {
          clientId: this.clientId,
          pincode: pincode,
        },
        { headers: this.generateAuthToken() }
      );

      if (response.data && response.data.success) {
        return {
          success: true,
          serviceable: response.data.data.serviceable,
          city: response.data.data.city,
          state: response.data.data.state,
          estimatedDays: response.data.data.estimatedDays,
          codAvailable: response.data.data.codAvailable,
        };
      } else {
        return {
          success: false,
          serviceable: false,
          message: 'Pincode not serviceable',
        };
      }
    } catch (error) {
      console.error('❌ BMC Pincode Check Error:', error.message);

      // Return default serviceable for development
      if (process.env.NODE_ENV === 'development') {
        return {
          success: true,
          serviceable: true,
          city: 'Unknown',
          state: 'Unknown',
          estimatedDays: 5,
          codAvailable: true,
          isDevelopmentMode: true,
        };
      }

      throw error;
    }
  }

  /**
   * Cancel Shipment (Docket Cancel API)
   * 
   * @param {String} awbNumber - AWB/Tracking number
   * @param {String} reason - Cancellation reason
   * @returns {Promise<Object>} Cancellation status
   */
  async cancelShipment(awbNumber, reason = 'Customer requested cancellation') {
    try {
      const response = await axios.post(
        `${this.apiUrl}/api/v1/docket/cancel`,
        {
          clientId: this.clientId,
          awbNumber: awbNumber,
          cancelReason: reason,
        },
        { headers: this.generateAuthToken() }
      );

      if (response.data && response.data.success) {
        return {
          success: true,
          awbNumber: awbNumber,
          message: 'Shipment cancelled successfully',
          cancelledAt: new Date(),
        };
      } else {
        throw new Error(response.data.message || 'Failed to cancel shipment');
      }
    } catch (error) {
      console.error('❌ BMC Cancellation Error:', error.message);
      throw error;
    }
  }

  /**
   * Create Reverse Shipment (Return Order)
   * 
   * @param {Object} returnData - Return shipment details
   * @returns {Promise<Object>} Reverse shipment details
   */
  async createReverseShipment(returnData) {
    try {
      const {
        originalAwb,
        orderCode,
        customerName,
        customerPhone,
        customerAddress,
        reason,
      } = returnData;

      const payload = {
        clientId: this.clientId,
        originalAwb: originalAwb,
        orderNo: `RET-${orderCode}`,

        // Pickup from customer
        pickupName: customerName,
        pickupAddress: customerAddress.addressLine1,
        pickupCity: customerAddress.city,
        pickupState: customerAddress.state,
        pickupPincode: customerAddress.pincode,
        pickupPhone: customerPhone,

        // Deliver to warehouse
        deliveryName: this.pickupAddress.name,
        deliveryAddress: this.pickupAddress.address,
        deliveryCity: this.pickupAddress.city,
        deliveryState: this.pickupAddress.state,
        deliveryPincode: this.pickupAddress.pincode,
        deliveryPhone: this.pickupAddress.phone,

        returnReason: reason,
        serviceType: 'REVERSE',
      };

      const response = await axios.post(
        `${this.apiUrl}/api/v1/reverse/create`,
        payload,
        { headers: this.generateAuthToken() }
      );

      if (response.data && response.data.success) {
        return {
          success: true,
          reverseAwb: response.data.data.awbNumber,
          pickupScheduled: response.data.data.pickupScheduled,
        };
      } else {
        throw new Error('Failed to create reverse shipment');
      }
    } catch (error) {
      console.error('❌ BMC Reverse Shipment Error:', error.message);
      throw error;
    }
  }

  /**
   * Map BMC status to our internal shipment status
   * 
   * @param {String} bmcStatus - BMC status code
   * @returns {String} Internal status
   */
  mapBMCStatus(bmcStatus) {
    const statusMap = {
      'ORDER_PLACED': 'PENDING',
      'PICKUP_SCHEDULED': 'PROCESSING',
      'PICKED_UP': 'READY_TO_SHIP',
      'IN_TRANSIT': 'IN_TRANSIT',
      'OUT_FOR_DELIVERY': 'OUT_FOR_DELIVERY',
      'DELIVERED': 'DELIVERED',
      'FAILED': 'FAILED',
      'RTO': 'RETURNED',
      'CANCELLED': 'CANCELLED',
    };

    return statusMap[bmcStatus] || 'PROCESSING';
  }

  /**
   * Sync tracking updates from BMC
   * This can be called periodically via cron job
   * 
   * @param {Array} awbNumbers - Array of AWB numbers to sync
   * @returns {Promise<Array>} Updated tracking data
   */
  async syncTrackingUpdates(awbNumbers) {
    try {
      const updates = [];

      for (const awbNumber of awbNumbers) {
        try {
          const trackingData = await this.trackShipment(awbNumber);
          updates.push(trackingData);
        } catch (error) {
          console.error(`Error syncing ${awbNumber}:`, error.message);
        }
      }

      return updates;
    } catch (error) {
      console.error('❌ BMC Sync Error:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new BMCService();














