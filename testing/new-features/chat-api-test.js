/**
 * Automated Test: In-App Chat Messaging & Image Attachment Suite
 * Targets:
 * - POST  /api/chat/conversations (Initiate/retrieve conversation room)
 * - POST  /api/chat/conversations/{id}/messages (Send text message or image attachment)
 * - GET   /api/chat/conversations/{id}/messages (Retrieve message thread history)
 * - PATCH /api/chat/conversations/{id}/read (Mark messages as read)
 *
 * Scenarios:
 * 1. Conversation Creation: Buyer and seller start a thread tied to a specific productId.
 * 2. Text Message Exchange: Sender posts a standard text message.
 * 3. Image Attachment Delivery: Sender posts an image message with valid attachmentUrl.
 * 4. Thread History Retrieval: Messages are returned in chronological order with metadata intact.
 * 5. Read Receipt Updating: Reader marks incoming messages as read, clearing unread counter.
 *
 * Execution:
 * - Standalone: `node testing/new-features/chat-api-test.js`
 * - Custom Gateway: `GATEWAY_URL=http://localhost:8080 node testing/new-features/chat-api-test.js`
 */

import http from "node:http";

const TARGET_URL = process.env.GATEWAY_URL || "http://localhost:8080";

let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition, description) {
  if (condition) {
    console.log(`  ✅ [PASS] ${description}`);
    passedAssertions++;
  } else {
    console.error(`  ❌ [FAIL] ${description}`);
    failedAssertions++;
  }
}

function createMockGatewayServer() {
  const conversations = new Map();
  const messagesByConv = new Map();

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Create / Get Conversation
    if (req.method === "POST" && url.pathname === "/api/chat/conversations") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const payload = JSON.parse(body);
          const { buyerId, sellerId, productId } = payload;

          if (!buyerId || !sellerId || !productId) {
            res.writeHead(400, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "buyerId, sellerId, and productId are required" }));
          }

          // Check if conversation already exists for this pair & product
          const existingKey = `${buyerId}:${sellerId}:${productId}`;
          let conv = conversations.get(existingKey);

          if (!conv) {
            const convId = `conv-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            conv = {
              id: convId,
              buyerId,
              sellerId,
              productId,
              createdAt: Date.now(),
              lastMessageAt: Date.now(),
              unreadCountBuyer: 0,
              unreadCountSeller: 0,
            };
            conversations.set(existingKey, conv);
            conversations.set(convId, conv);
            messagesByConv.set(convId, []);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          return res.end(JSON.stringify(conv));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    // Send Message
    if (req.method === "POST" && url.pathname.match(/\/api\/chat\/conversations\/[^/]+\/messages/)) {
      const convId = url.pathname.split("/")[4];
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const conv = conversations.get(convId);
          if (!conv) {
            res.writeHead(404, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "Conversation not found" }));
          }

          const payload = JSON.parse(body);
          const { senderId, content, attachmentUrl, messageType = "TEXT" } = payload;

          if (!senderId || (!content && !attachmentUrl)) {
            res.writeHead(400, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ error: "senderId and either content or attachmentUrl required" }));
          }

          const messageId = `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const msg = {
            id: messageId,
            conversationId: convId,
            senderId,
            content: content || "",
            attachmentUrl: attachmentUrl || null,
            messageType: attachmentUrl ? "IMAGE" : messageType,
            createdAt: Date.now(),
            read: false,
          };

          const thread = messagesByConv.get(convId) || [];
          thread.push(msg);
          messagesByConv.set(convId, thread);

          // Update unread count
          if (senderId === conv.buyerId) {
            conv.unreadCountSeller += 1;
          } else {
            conv.unreadCountBuyer += 1;
          }
          conv.lastMessageAt = msg.createdAt;

          res.writeHead(201, { "Content-Type": "application/json" });
          return res.end(JSON.stringify(msg));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    // Get Messages
    if (req.method === "GET" && url.pathname.match(/\/api\/chat\/conversations\/[^/]+\/messages/)) {
      const convId = url.pathname.split("/")[4];
      const conv = conversations.get(convId);
      if (!conv) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Conversation not found" }));
      }

      const thread = messagesByConv.get(convId) || [];
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          conversationId: convId,
          messages: thread,
          total: thread.length,
        })
      );
    }

    // Mark as Read
    if (req.method === "PATCH" && url.pathname.match(/\/api\/chat\/conversations\/[^/]+\/read/)) {
      const convId = url.pathname.split("/")[4];
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const conv = conversations.get(convId);
        if (!conv) {
          res.writeHead(404, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Conversation not found" }));
        }

        const payload = JSON.parse(body || "{}");
        const readerId = payload.readerId;

        if (readerId === conv.buyerId) {
          conv.unreadCountBuyer = 0;
        } else if (readerId === conv.sellerId) {
          conv.unreadCountSeller = 0;
        }

        const thread = messagesByConv.get(convId) || [];
        thread.forEach((m) => {
          if (m.senderId !== readerId) {
            m.read = true;
          }
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: true, conversation: conv }));
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  return server;
}

async function isServerRunning(url) {
  try {
    const res = await fetch(`${url}/actuator/health`, { method: "GET" }).catch(() => null);
    return res && res.ok;
  } catch {
    return false;
  }
}

async function runTests() {
  console.log("============================================================");
  console.log("🧪 SHOPi QA: In-App Chat & Image Attachment Test Suite");
  console.log("============================================================");

  let server;
  let baseUrl = TARGET_URL;

  const live = await isServerRunning(baseUrl);
  if (!live) {
    console.log("ℹ️  Live API Gateway not detected on port 8080.");
    console.log("🚀 Spinning up ephemeral Chat Mock Gateway on port 8085...");
    server = createMockGatewayServer();
    await new Promise((resolve) => server.listen(8085, resolve));
    baseUrl = "http://localhost:8085";
  } else {
    console.log(`🌐 Connected to live target: ${baseUrl}`);
  }

  try {
    const buyerId = "buyer-alice-chat";
    const sellerId = "seller-bob-studio";
    const productId = "prod-macbook-pro-16-m1-max";

    // -------------------------------------------------------------
    // Test 1: Create or Get Conversation Room
    // -------------------------------------------------------------
    console.log("\n▶ Test 1: Create Conversation between Buyer and Seller");
    const convRes = await fetch(`${baseUrl}/api/chat/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyerId, sellerId, productId }),
    });

    assert(convRes.status === 200 || convRes.status === 201, `Conversation created with HTTP ${convRes.status}`);
    const convData = await convRes.json();
    const convId = convData.id;
    assert(typeof convId === "string" && convId.startsWith("conv-"), `Valid conversationId returned: ${convId}`);
    assert(convData.buyerId === buyerId, "Conversation buyerId matches");
    assert(convData.sellerId === sellerId, "Conversation sellerId matches");
    assert(convData.productId === productId, "Conversation productId matches");

    // -------------------------------------------------------------
    // Test 2: Send Text Message
    // -------------------------------------------------------------
    console.log("\n▶ Test 2: Send Text Message in Conversation");
    const textMessagePayload = {
      senderId: buyerId,
      content: "Chào shop, máy MacBook Pro này có còn đủ củ sạc 140W và hộp zin không ạ?",
      messageType: "TEXT",
    };

    const msg1Res = await fetch(`${baseUrl}/api/chat/conversations/${convId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(textMessagePayload),
    });

    assert(msg1Res.status === 201, `Text message sent with HTTP 201 Created (Got: ${msg1Res.status})`);
    const msg1Data = await msg1Res.json();
    assert(msg1Data.content === textMessagePayload.content, "Text message content preserved accurately");
    assert(msg1Data.messageType === "TEXT", "Message type verified as TEXT");
    assert(msg1Data.senderId === buyerId, "Sender ID matches buyer");

    // -------------------------------------------------------------
    // Test 3: Send Message with Image Attachment
    // -------------------------------------------------------------
    console.log("\n▶ Test 3: Send Message with Image Attachment URL");
    const imageMessagePayload = {
      senderId: sellerId,
      content: "Dạ hộp và củ sạc zin 140W MagSafe 3 đầy đủ như trong ảnh này bạn nhé:",
      attachmentUrl: "https://cdn.shopi.vn/chat/attachments/macbook-charger-proof.jpg",
      messageType: "IMAGE",
    };

    const msg2Res = await fetch(`${baseUrl}/api/chat/conversations/${convId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(imageMessagePayload),
    });

    assert(msg2Res.status === 201, `Image message sent with HTTP 201 Created (Got: ${msg2Res.status})`);
    const msg2Data = await msg2Res.json();
    assert(msg2Data.attachmentUrl === imageMessagePayload.attachmentUrl, "Image attachment URL preserved accurately");
    assert(msg2Data.messageType === "IMAGE", "Message type verified as IMAGE");
    assert(msg2Data.senderId === sellerId, "Sender ID matches seller");

    // -------------------------------------------------------------
    // Test 4: Retrieve Conversation Thread History
    // -------------------------------------------------------------
    console.log("\n▶ Test 4: Retrieve Message Thread History");
    const historyRes = await fetch(`${baseUrl}/api/chat/conversations/${convId}/messages`);
    assert(historyRes.status === 200, `Message history returns HTTP 200 OK (Got: ${historyRes.status})`);

    const historyData = await historyRes.json();
    assert(Array.isArray(historyData.messages), "History payload contains messages array");
    assert(historyData.messages.length === 2, `History contains exactly 2 messages (Got: ${historyData.messages.length})`);

    // Verify chronological order and content
    assert(historyData.messages[0].messageType === "TEXT", "First message is the TEXT query from buyer");
    assert(historyData.messages[1].messageType === "IMAGE", "Second message is the IMAGE response from seller");
    assert(historyData.messages[1].attachmentUrl.includes("macbook-charger-proof.jpg"), "Image attachment URL intact in history");

    // -------------------------------------------------------------
    // Test 5: Mark Thread as Read
    // -------------------------------------------------------------
    console.log("\n▶ Test 5: Mark Conversation Thread as Read");
    const readRes = await fetch(`${baseUrl}/api/chat/conversations/${convId}/read`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readerId: buyerId }),
    });

    assert(readRes.status === 200, `Mark as read returns HTTP 200 OK (Got: ${readRes.status})`);
    const readData = await readRes.json();
    assert(readData.conversation.unreadCountBuyer === 0, "Buyer unread counter successfully reset to 0");
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log("\n🛑 Ephemeral Chat Mock Gateway stopped.");
    }
  }

  console.log("\n============================================================");
  console.log(`📊 Test Summary: ${passedAssertions} Passed, ${failedAssertions} Failed`);
  console.log("============================================================");

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal test execution error:", err);
  process.exit(1);
});
