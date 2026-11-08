const SupportTicket = require('../models/SupportTicket');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8183795463:AAFm05t05k_xoAwuh7jgCn1ktYLDdoDgDH4';
const SUPPORT_CHANNEL_ID = process.env.TELEGRAM_SUPPORT_CHANNEL_ID || '-1003901566822';
const ADMIN_DIRECT_CHAT_IDS = ['553538094']; // Frederic Eger (direct chat fallback for swipe-replies)
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * Send a message via Telegram Bot API
 */
async function sendTelegramMessage(chatId, text, options = {}) {
  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options.parseMode || 'HTML',
        reply_to_message_id: options.replyToMessageId,
        ...options
      })
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn(`[TelegramSupport] Failed to send message to ${chatId}:`, data.description);
      return null;
    }
    return data.result;
  } catch (err) {
    console.error(`[TelegramSupport] Network error sending to ${chatId}:`, err.message);
    return null;
  }
}

/**
 * Dispatch new user support ticket / follow-up message to Telegram
 */
async function notifyNewTicketMessage(ticket, messageText) {
  const isNewTicket = ticket.messages.length <= 1;
  const header = isNewTicket
    ? `🎫 <b>New Support Request [${ticket.ticketNumber}]</b>`
    : `💬 <b>Update on [${ticket.ticketNumber}]</b>`;

  const safeName = (ticket.userName || 'Community Member').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeEmail = (ticket.userEmail || 'N/A').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeText = (messageText || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const platform = ticket.userPlatform === 'community' ? 'ITV Community Platform' : 'ITV Main Website';

  const formattedMsg = [
    header,
    `👤 <b>User:</b> ${safeName} (${safeEmail})`,
    `🌐 <b>Origin:</b> ${platform}`,
    `🕒 <b>Time:</b> ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    '',
    `<b>Message:</b>`,
    `<i>"${safeText}"</i>`,
    '',
    `👉 <i>Reply directly to this message to send your answer to the user in real time.</i>`
  ].join('\n');

  const targets = [SUPPORT_CHANNEL_ID, ...ADMIN_DIRECT_CHAT_IDS];
  const newTelegramMappings = [];

  for (const chatId of targets) {
    if (!chatId) continue;
    const sent = await sendTelegramMessage(chatId, formattedMsg);
    if (sent && sent.message_id) {
      newTelegramMappings.push({
        chatId: String(chatId),
        messageId: sent.message_id
      });
    }
  }

  if (newTelegramMappings.length > 0) {
    ticket.telegramMessages = [...(ticket.telegramMessages || []), ...newTelegramMappings];
    await ticket.save();
  }

  return ticket;
}

/**
 * Handle incoming Webhook from Telegram when admin replies
 */
async function handleTelegramWebhook(update, io) {
  if (!update) return;

  const message = update.message || update.channel_post;
  if (!message || !message.text) return;

  // Check if admin replied to a message sent by the bot
  const replyTo = message.reply_to_message;
  let targetTicket = null;

  if (replyTo && replyTo.message_id) {
    // 1. Direct message ID match
    targetTicket = await SupportTicket.findOne({
      'telegramMessages.messageId': replyTo.message_id
    });

    // 2. If replied inside channel discussion group (linked to original channel post)
    if (!targetTicket && replyTo.forward_from_message_id) {
      targetTicket = await SupportTicket.findOne({
        'telegramMessages.messageId': replyTo.forward_from_message_id
      });
    }

    // 3. Telegram Bot API 7.0+ forward_origin structure
    if (!targetTicket && replyTo.forward_origin?.message_id) {
      targetTicket = await SupportTicket.findOne({
        'telegramMessages.messageId': replyTo.forward_origin.message_id
      });
    }
  }

  // 2. Fallback: Parse ticket number from reply text or replied text: e.g. #ITV-1024
  if (!targetTicket) {
    const combinedText = `${message.text} ${replyTo?.text || ''}`;
    const match = combinedText.match(/#?(ITV-[A-Z0-9]+)/i);
    if (match && match[1]) {
      targetTicket = await SupportTicket.findOne({ ticketNumber: match[1].toUpperCase() });
    }
  }

  if (!targetTicket) {
    console.log('[TelegramSupport] Received message not linked to any ticket:', message.text);
    return;
  }

  // Admin reply content
  const adminName = message.from?.first_name 
    ? `${message.from.first_name} (Support)` 
    : 'iTV Support Team';
  
  const replyText = message.text.trim();

  // Save support message in ticket
  targetTicket.messages.push({
    sender: 'support',
    senderName: adminName,
    text: replyText,
    timestamp: new Date()
  });

  targetTicket.status = 'in_progress';
  await targetTicket.save();

  console.log(`[TelegramSupport] Admin replied to ${targetTicket.ticketNumber}: "${replyText}"`);

  // Emit to website user via Socket.io
  if (io) {
    const payload = {
      ticketId: targetTicket._id,
      ticketNumber: targetTicket.ticketNumber,
      message: {
        sender: 'support',
        senderName: adminName,
        text: replyText,
        timestamp: new Date()
      }
    };

    io.to(`support_${targetTicket._id}`).emit('support_reply', payload);
    io.to(`support_${targetTicket.ticketNumber}`).emit('support_reply', payload);
    if (targetTicket.userId) {
      io.to(targetTicket.userId.toString()).emit('support_reply', payload);
    }
    if (targetTicket.guestSessionId) {
      io.to(`guest_${targetTicket.guestSessionId}`).emit('support_reply', payload);
    }
  }

  // Acknowledge in Telegram with reaction or reply
  try {
    await fetch(`${TELEGRAM_API_BASE}/setMessageReaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: message.chat.id,
        message_id: message.message_id,
        reaction: [{ type: 'emoji', emoji: '👌' }]
      })
    });
  } catch (e) {}
}

/**
 * Automatically set Telegram Webhook on server start
 */
async function registerTelegramWebhook(serverDomain = 'https://api.interplanetary.tv') {
  const webhookUrl = `${serverDomain}/api/support/telegram-webhook`;
  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'channel_post', 'edited_message']
      })
    });
    const data = await res.json();
    console.log('[TelegramSupport] Webhook registered:', webhookUrl, data);
    return data;
  } catch (err) {
    console.error('[TelegramSupport] Webhook registration failed:', err.message);
  }
}

module.exports = {
  sendTelegramMessage,
  notifyNewTicketMessage,
  handleTelegramWebhook,
  registerTelegramWebhook,
  BOT_TOKEN,
  SUPPORT_CHANNEL_ID
};

