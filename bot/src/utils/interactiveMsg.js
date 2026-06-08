/**
 * DLavie OS — Interactive Message Utility
 * Sends interactiveMessage + nativeFlowMessage with proper binary node wrappers
 * required by WhatsApp Business iOS (biz / interactive / native_flow / bot nodes).
 *
 * Research findings (2025):
 * - buttonsMessage / listMessage: DEPRECATED, silently dropped by WA
 * - interactiveMessage + nativeFlowMessage: modern replacement, works on WA Business iOS
 * - Stock @whiskeysockets/baileys lacks binary node wrappers → must inject via additionalNodes
 * - Private chat requires { tag:'bot', attrs:{biz_bot:'1'} } node for button rendering
 */

'use strict';

const {
  generateWAMessageFromContent,
  generateMessageIDV2,
  isJidGroup,
  proto,
} = require('@whiskeysockets/baileys');

/**
 * Build the additionalNodes required for interactiveMessage rendering on iOS.
 * @param {string} jid  - recipient JID
 * @returns {Array}     - array of binary nodes to pass to relayMessage
 */
function buildInteractiveNodes(jid) {
  const bizNode = {
    tag: 'biz',
    attrs: {},
    content: [
      {
        tag: 'interactive',
        attrs: { type: 'native_flow', v: '1' },
        content: [
          { tag: 'native_flow', attrs: { name: 'interactiveMessage' } },
        ],
      },
    ],
  };

  const nodes = [bizNode];
  // Private (1:1) chats need the 'bot' node to enable rendering on iOS
  if (!isJidGroup(jid)) {
    nodes.push({ tag: 'bot', attrs: { biz_bot: '1' } });
  }
  return nodes;
}

/**
 * Send an interactiveMessage with nativeFlowMessage buttons.
 *
 * @param {object} sock         - Baileys socket
 * @param {string} jid          - recipient JID
 * @param {object} opts
 * @param {string} opts.body    - main message text
 * @param {string} [opts.title] - header title (optional)
 * @param {string} [opts.footer]- footer text (optional)
 * @param {Array}  opts.buttons - array of { name, buttonParamsJson } objects
 *   Supported names: 'quick_reply', 'single_select', 'cta_url', 'cta_copy', 'cta_call'
 *   buttonParamsJson must be a JSON STRING (already JSON.stringify'd)
 * @param {object} [opts.quoted]- message to quote/reply (optional)
 *
 * @returns {Promise<boolean>}  - true if sent, false if failed
 */
async function sendInteractiveMsg(sock, jid, opts = {}) {
  const { body = '', title = '', footer = '', buttons = [], quoted } = opts;

  try {
    const interactiveProto = proto.Message.InteractiveMessage.create({
      body:   proto.Message.InteractiveMessage.Body.create({ text: body }),
      footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
      header: proto.Message.InteractiveMessage.Header.create({
        title:             title,
        hasMediaAttachment: false,
      }),
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
        buttons: buttons.map(b =>
          proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowButton.create({
            name:             b.name,
            buttonParamsJson: typeof b.buttonParamsJson === 'string'
              ? b.buttonParamsJson
              : JSON.stringify(b.buttonParamsJson),
          })
        ),
      }),
    });

    const msgContent = {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata:        {},
            deviceListMetadataVersion: 2,
          },
          interactiveMessage: interactiveProto,
        },
      },
    };

    const waMsg = generateWAMessageFromContent(jid, msgContent, {
      userJid:       sock.user?.id,
      quoted,
    });

    await sock.relayMessage(jid, waMsg.message, {
      messageId:       waMsg.key.id,
      additionalNodes: buildInteractiveNodes(jid),
    });

    return true;
  } catch (err) {
    console.warn('[INTERACTIVE] Send failed:', err.message);
    return false;
  }
}

/**
 * Handle incoming interactiveResponseMessage — extract button response.
 * @param {object} waMsg  - raw WA message object
 * @returns {{ name, id, displayText, params } | null}
 */
function parseInteractiveResponse(waMsg) {
  const resp = waMsg?.message?.interactiveResponseMessage?.nativeFlowResponseMessage;
  if (!resp) return null;
  try {
    const params = JSON.parse(resp.paramsJson || '{}');
    return {
      name:        resp.name,                            // e.g. 'quick_reply'
      id:          params.id || params.rowId || '',
      displayText: params.display_text || params.title || params.id || '',
      params,
    };
  } catch (_) {
    return null;
  }
}

module.exports = { sendInteractiveMsg, parseInteractiveResponse, buildInteractiveNodes };
