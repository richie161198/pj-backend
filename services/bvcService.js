const axios = require("axios");

/**
 * BVC Logistics API Integration Service
 *
 * API Endpoints:
 * - PushOrderUpload: Create forward shipment orders
 * - GetDocketTrackingDetails: Track shipments
 * - PushReverseOrder: Create return/reverse orders
 * - PushDocketCancel: Cancel shipments
 */

class BVCService {
  constructor() {
    // BVC API Configuration
    this.customerId = process.env.BVC_CUSTOMER_ID || "CC000700340";
    this.agentId = process.env.BVC_AGENT_ID || "KSAN0001";
    this.customerAuthToken =
      process.env.BVC_CUSTOMER_AUTH_TOKEN ||
      "7DxYpMa0LhYvwp0tyo+9iQ==";
    this.customerPublicKey =
      process.env.BVC_CUSTOMER_PUBLIC_KEY ||
      "174EE6D5-B9FB-482B-AA1B-1378673661A2";
      this.token = process.env.BVC_API_TOKEN || "oOwCZ4oD/y8OFyG4H1y6AoQ7UxGFJwZLCaKvAk5a5MdxT0YlUaIFUTfC4pS/XQXU43HCRXZIr7bWNNuC/PKbAHrd7wQCEXYs2ZI+Sr1Fvunxa7U6NnnJzaHYPdmHHjpv";
      this.tokenTimestamp = "202510131455560291";
    this.orderUploadUrl =
      "https://bvcmars.com/RestService/OrderUploadService.svc/PushOrderUpload";
    this.reverseOrderUrl =
      "https://bvcmars.com/RestService/OrderUploadService.svc/PushReverseOrder";
    this.trackingUrl =
      "https://bvcmars.com/RestService/TrackingService.svc/GetDocketTrackingDetails";
    this.cancelUrl =
      "https://bvcmars.com/RestService/DocketCancelService.svc/PushDocketCancel";

  }


  async getHeaders() {
    return {
      "Content-Type": "application/json",
      "XX-Authentication-Token": this.token,
      TimeStamp: this.tokenTimestamp,
      Cookie: "ASP.NET_SessionId=yphl1cbzbhjpgpcyydtaymkb; ASP.NET_SessionId=mrnbwddzkztglhcm4bxqughr; ASP.NET_SessionId=su4uzueolzmrskhnzwadxaqy",
    };
  }


  async createShipment(orderData) {
    try {
      const {
        orderCode,
        customerName,
        customerPhone,
        deliveryAddress,
        items,
        totalAmount,
        codAmount = 0,
        weight = 0.5,
        packageCount = 1,
      } = orderData;

      // Generate unique AWB number (8 characters max)
      const awbNo = function random8() {
  return Math.floor(10000000 + Math.random() * 90000000);
};

      // Build order payload
      const orderPayload = {
        OrderNo: orderCode,
        AgentID: this.agentId,
        ProductCode: items?.[0]?.productCode || "Gold Asset",
        ItemName: items?.[0]?.productName || "Asset Purchase",
        AWBNo: awbNo(),
        No_Of_Pieces: packageCount,
        CustomerName: customerName,
        CustomerAdd1: deliveryAddress?.addressLine1 || deliveryAddress?.street || "N/A",
        CustomerAdd2: deliveryAddress?.addressLine2 || deliveryAddress?.landmark || "",
        CustomerCity: deliveryAddress?.city || "N/A",
        CustomerState: deliveryAddress?.state || "N/A",
        CustomerPincode: deliveryAddress?.pincode || "XXXXXXXX",
        CustomerTeleNo: customerPhone || "XXXXXXXXXX",
        CustomerMobileNo: customerPhone || "XXXXXXXX",
        TotalAmt: totalAmount,
        // PaymentMode: codAmount > 0 ? "C" : "P", // C = COD, P = Prepaid
        PaymentMode:  "P", // C = COD, P = Prepaid
        // CollectableAmt: codAmount,
        CollectableAmt: "0",
        Weight: weight,
        UOM: "Per KG",
        ServiceType: "Express",
      };

      const payload = {
        CustomerId: this.customerId,
        OrderUploadData: [orderPayload],
      };

      console.log("📦 Creating BVC Shipment for order:", orderCode);
      console.log("📦 BVC Payload:", JSON.stringify(payload, null, 2));

      const headers = await this.getHeaders();
      const response = await axios.post(this.orderUploadUrl, payload, { headers });

      console.log("📦 BVC Response:", JSON.stringify(response.data, null, 2));

      const result = response.data?.OrderUploadResult?.[0];

      if (response.data?.Success && result?.Succeed) {
        console.log("✅ BVC Shipment Created:", result.DockNo);
        return {
          success: true,
          docketNo: result.DockNo,
          orderNo: result.OrderNo,
          awbNo: awbNo,
          message: result.Reason,
          courierName: "BVC Logistics",
          rawResponse: response.data,
        };
      } else {
        const errorMessage = result?.Reason || response.data?.Message || "BVC shipment creation failed";
        console.error("❌ BVC Shipment Failed:", errorMessage);
        return {
          success: false,
          error: errorMessage,
          awbNo: awbNo,
          rawResponse: response.data,
        };
      }
    } catch (error) {
      console.error("❌ BVC Shipment Error:", error.message);
      return {
        success: false,
        error: error.message,
        awbNo: `PG${Date.now()}`.slice(0, 9),
      };
    }
  }

  async trackShipment(docketNo) {
    try {
      if (!docketNo) {
        throw new Error("Docket number is required");
      }

      console.log("🔍 Tracking BVC Shipment:", docketNo);

      const headers = await this.getHeaders();
      const response = await axios.post(
        this.trackingUrl,
        { DocketNos: [docketNo] },
        { headers }
      );

      const responseData = response.data || {};

      // Check if API call was successful
      if (responseData.IsSuccess === false) {
        throw new Error(responseData.Message || "Tracking failed");
      }

      // The response has a Dockets array, get the first docket
      const dockets = responseData.Dockets || [];
      if (dockets.length === 0) {
        throw new Error("No tracking data found for docket number");
      }

      const docket = dockets[0]; // Get first docket from array

      const trackList = docket.DocketTrackList || [];
      const trackingHistory = trackList.map((entry) => ({
        status: entry.DocketStatus,
        statusCode: entry.TRACKING_CODE,
        city: entry.City,
        date: entry.Date,
        time: entry.Time,
        timestamp: this._parseDate(entry.Date, entry.Time),
      }));

      // Determine order status from BVC status
      const orderStatus = this._mapBvcStatusToOrderStatus(docket.DocketStatus);

      console.log("✅ BVC Tracking Data Retrieved for:", docketNo);
      console.log("📦 Tracking History Count:", trackingHistory.length);

      return {
        success: true,
        docketNo: docket.DocketNo,
        orderNo: docket.OrderNo,
        status: docket.DocketStatus,
        statusCode: docket.TrackingCode,
        orderStatus: orderStatus,
        deliveryType: docket.DeliveryType,
        serviceType: docket.ServiceType,
        originCity: docket.OriginCity,
        destinationCity: docket.DestinationCity,
        receiverName: docket.ReciverName,
        receiverPhone: docket.ReciverContactNo,
        pincode: docket.Pincode,
        noOfPieces: docket.NoOfPieces,
        actualWeight: docket.ActualWeight,
        chargedWeight: docket.ChargedWeight,
        amount: docket.Amount,
        codAmount: docket.CODAmount,
        ndrReason: docket.NDRReason,
        trackingHistory: trackingHistory,
        rawResponse: responseData, // Include full response
      };
    } catch (error) {
      console.error("❌ BVC Tracking Error:", error.message);
      throw error;
    }
  }


  async createReverseShipment(returnData) {
    try {
      const {
        requestId,
        awbNo,
        customerName,
        customerAddress,
        customerPincode,
        customerPhone,
        weight = 0.5,
        skuDescription,
        value,
      } = returnData;

      const reversePayload = {
        RequestId: requestId || `RET${Date.now()}`,
        AWBNo: awbNo,
        ConsignorName: customerName,
        ConsignorAddress1: customerAddress?.addressLine1 || customerAddress,
        ConsignorAddress2: customerAddress?.addressLine2 || "",
        Pincode: customerPincode || customerAddress?.pincode || "000000",
        MobileNo: customerPhone || "0000000000",
        Weight: weight,
        UOM: "Per KG",
        SKUDescription: skuDescription || "Return Item",
        Value: value || 1.0,
        AgentID: this.agentId,
      };

      const payload = {
        CustomerId: this.customerId,
        RevereseOrder: [reversePayload],
      };

      console.log("🔄 Creating BVC Reverse Shipment:", requestId);

      const headers = await this.getHeaders();
      const response = await axios.post(this.reverseOrderUrl, payload, { headers });

      console.log("🔄 BVC Reverse Response:", JSON.stringify(response.data, null, 2));

      const result = response.data?.RevereseOrderResult?.[0];

      if (response.data?.Success && result?.Succeed === "true") {
        console.log("✅ BVC Reverse Shipment Created:", result.AWBNo);
        return {
          success: true,
          reverseAwbNo: result.AWBNo,
          message: result.Reason,
          rawResponse: response.data,
        };
      } else {
        const errorMessage = result?.Reason || "Reverse shipment creation failed";
        console.error("❌ BVC Reverse Shipment Failed:", errorMessage);
        return {
          success: false,
          error: errorMessage,
          rawResponse: response.data,
        };
      }
    } catch (error) {
      console.error("❌ BVC Reverse Shipment Error:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Cancel Shipment (PushDocketCancel)
   *
   * @param {String} docketNo - Docket number to cancel
   * @param {String} remarks - Cancellation reason
   * @returns {Promise<Object>} Cancellation response
   */
  async cancelShipment(docketNo, remarks = "Customer requested cancellation") {
    try {
      if (!docketNo) {
        throw new Error("Docket number is required");
      }

      const payload = {
        DocketCancelData: [
          {
            DockNo: docketNo,
            Remarks: remarks,
          },
        ],
      };

      console.log("❌ Cancelling BVC Shipment:", docketNo);

      const headers = await this.getHeaders();
      const response = await axios.post(this.cancelUrl, payload, { headers });

      console.log("❌ BVC Cancel Response:", JSON.stringify(response.data, null, 2));

      const result = response.data?.DocketCancelResult?.[0];

      if (response.data?.Success && result?.Succeed) {
        console.log("✅ BVC Shipment Cancelled:", docketNo);
        return {
          success: true,
          docketNo: result.DockNo,
          reason: result.Reason,
          message: response.data.Message,
          cancelledAt: new Date(),
          rawResponse: response.data,
        };
      } else {
        const errorMessage = result?.Reason || response.data?.Message || "Cancellation failed";
        console.error("❌ BVC Cancellation Failed:", errorMessage);
        return {
          success: false,
          error: errorMessage,
          rawResponse: response.data,
        };
      }
    } catch (error) {
      console.error("❌ BVC Cancellation Error:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Helper: Parse BVC date format to JavaScript Date
   */
  _parseDate(dateStr, timeStr) {
    try {
      if (!dateStr) return new Date();
      // BVC format: "20 Feb 2020", "14:49:34"
      const dateParts = dateStr.split(" ");
      const months = {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
      };
      const day = parseInt(dateParts[0]);
      const month = months[dateParts[1]] || 0;
      const year = parseInt(dateParts[2]);

      let hours = 0, minutes = 0, seconds = 0;
      if (timeStr) {
        const timeParts = timeStr.split(":");
        hours = parseInt(timeParts[0]) || 0;
        minutes = parseInt(timeParts[1]) || 0;
        seconds = parseInt(timeParts[2]) || 0;
      }

      return new Date(year, month, day, hours, minutes, seconds);
    } catch (e) {
      return new Date();
    }
  }

  /**
   * Helper: Map BVC status to internal order status
   */
  _mapBvcStatusToOrderStatus(bvcStatus) {
    if (!bvcStatus) return "PROCESSING";

    const statusLower = bvcStatus.toLowerCase();

    if (statusLower.includes("delivered")) return "DELIVERED";
    if (statusLower.includes("out for delivery")) return "OUT_FOR_DELIVERY";
    if (statusLower.includes("in transit")) return "IN_TRANSIT";
    if (statusLower.includes("picked up") || statusLower.includes("booking processed")) return "PICKED_UP";
    if (statusLower.includes("pickup")) return "PICKUP_SCHEDULED";
    if (statusLower.includes("rto") || statusLower.includes("return")) return "RTO_INITIATED";
    if (statusLower.includes("cancelled") || statusLower.includes("cancel")) return "CANCELLED";
    if (statusLower.includes("failed")) return "FAILED";

    return "PROCESSING";
  }

  /**
   * Map BVC status to readable label for frontend
   */
  getStatusLabel(bvcStatus) {
    if (!bvcStatus) return "Processing";

    const statusLower = bvcStatus.toLowerCase();

    if (statusLower.includes("delivered")) return "Delivered";
    if (statusLower.includes("out for delivery")) return "Out for Delivery";
    if (statusLower.includes("arrived at destination")) return "Arrived at Destination";
    if (statusLower.includes("in transit")) return "In Transit";
    if (statusLower.includes("picked up") || statusLower.includes("booking processed")) return "Picked Up";
    if (statusLower.includes("out for pickup")) return "Out for Pickup";
    if (statusLower.includes("available for pickup")) return "Ready for Pickup";
    if (statusLower.includes("rto")) return "Return to Origin";
    if (statusLower.includes("cancelled")) return "Cancelled";

    return bvcStatus;
  }
}

// Export singleton instance
module.exports = new BVCService();

