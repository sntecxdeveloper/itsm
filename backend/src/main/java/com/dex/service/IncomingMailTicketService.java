package com.dex.service;

import com.dex.dto.itsm.ItsmTicketResponse;
import com.dex.repository.UserRepository;
import jakarta.mail.Address;
import jakarta.mail.Flags;
import jakarta.mail.Folder;
import jakarta.mail.Message;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.Store;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.search.FlagTerm;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Locale;

/**
 * Reads unread mail from the configured incoming (IMAP) mailbox, raises a ticket for each message
 * from a known sender and replies to the sender with the ticket number.
 */
@Service
public class IncomingMailTicketService {

    private static final Logger logger = LoggerFactory.getLogger(IncomingMailTicketService.class);
    private static final int MAX_BODY_CHARS = 5000;
    private static final int MAX_MESSAGES_PER_POLL = 25;

    private final MailSettingsService settings;
    private final ItsmService itsm;
    private final UserRepository users;
    private final ResendEmailService email;
    private final MailLogService mailLog;

    public IncomingMailTicketService(MailSettingsService settings, ItsmService itsm,
                                     UserRepository users, ResendEmailService email, MailLogService mailLog) {
        this.mailLog = mailLog;
        this.settings = settings;
        this.itsm = itsm;
        this.users = users;
        this.email = email;
    }

    @Scheduled(fixedDelayString = "${mail-settings.incoming-poll-interval-ms:60000}",
            initialDelayString = "${mail-settings.incoming-poll-interval-ms:60000}")
    public void poll() {
        MailSettingsService.IncomingConfig config;
        try {
            config = settings.incomingConfig();
        } catch (Exception e) {
            logger.warn("Incoming mail skipped: {}", e.getMessage());
            return;
        }
        if (config == null) return;
        if (!config.protocol().equals("IMAP")) {
            logger.warn("Incoming mail to ticket needs IMAP; {} is not supported", config.protocol());
            return;
        }
        try (Store store = settings.connectIncoming(config)) {
            Folder inbox = store.getFolder("INBOX");
            inbox.open(Folder.READ_WRITE);
            try {
                Message[] unread = inbox.search(new FlagTerm(new Flags(Flags.Flag.SEEN), false));
                int limit = Math.min(unread.length, MAX_MESSAGES_PER_POLL);
                for (int i = 0; i < limit; i++) handle(unread[i], config.username());
            } finally {
                inbox.close(false);
            }
        } catch (Exception e) {
            logger.warn("Could not read the incoming mailbox: {}", e.getMessage());
        }
    }

    private void handle(Message message, String mailbox) {
        try {
            // Mark as read first so a failure never causes the same mail to raise tickets repeatedly.
            message.setFlag(Flags.Flag.SEEN, true);
            String sender = senderAddress(message);
            if (sender == null || isAutomated(message) || sender.equalsIgnoreCase(mailbox)) return;
            if (!isKnownSender(sender, mailbox)) {
                logger.info("Ignored mail from unknown sender {}", sender);
                return;
            }
            String body = bodyText(message);
            if (body.length() > MAX_BODY_CHARS) body = body.substring(0, MAX_BODY_CHARS);
            ItsmTicketResponse ticket = itsm.createEmailTicket(message.getSubject(), body, sender);
            mailLog.recordReceived(sender, message.getSubject(), body, ticket.getTicketCode());
            sendConfirmation(sender, ticket);
        } catch (Exception e) {
            logger.warn("Could not turn an incoming mail into a ticket: {}", e.getMessage());
        }
    }

    /** A DEX user, or anyone at the same domain as the support mailbox. */
    private boolean isKnownSender(String sender, String mailbox) {
        if (users.findByEmail(sender).isPresent()) return true;
        int at = mailbox.lastIndexOf('@');
        return at > 0 && sender.toLowerCase(Locale.ROOT).endsWith(mailbox.substring(at).toLowerCase(Locale.ROOT));
    }

    /** Skips auto-replies, bounces and bulk mail so two systems can never answer each other in a loop. */
    private static boolean isAutomated(Message message) throws Exception {
        String[] auto = message.getHeader("Auto-Submitted");
        if (auto != null) {
            for (String value : auto) if (!value.trim().equalsIgnoreCase("no")) return true;
        }
        String[] precedence = message.getHeader("Precedence");
        if (precedence != null) {
            for (String value : precedence) {
                String v = value.trim().toLowerCase(Locale.ROOT);
                if (v.equals("bulk") || v.equals("junk") || v.equals("list")) return true;
            }
        }
        return false;
    }

    private static String senderAddress(Message message) throws Exception {
        Address[] from = message.getFrom();
        if (from == null || from.length == 0) return null;
        return from[0] instanceof InternetAddress ia ? ia.getAddress() : null;
    }

    private void sendConfirmation(String to, ItsmTicketResponse ticket) {
        String html = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #1e293b;">We received your request</h2>
                  <p><strong>Ticket number:</strong> %s</p>
                  <p><strong>Subject:</strong> %s</p>
                  <p><strong>Status:</strong> Open</p>
                  <p style="color: #64748b; font-size: 14px;">Our support team will get back to you.</p>
                </div>
                """.formatted(escape(ticket.getTicketCode()), escape(ticket.getTitle()));
        String error = email.send(to, "Ticket " + ticket.getTicketCode() + " created: " + ticket.getTitle(), html);
        if (error != null) logger.warn("Ticket {} created but confirmation to {} failed: {}",
                ticket.getTicketCode(), to, error);
    }

    private static String bodyText(Part part) throws Exception {
        if (part.isMimeType("text/plain")) return String.valueOf(part.getContent()).trim();
        if (part.isMimeType("multipart/*")) {
            Multipart multipart = (Multipart) part.getContent();
            String html = null;
            for (int i = 0; i < multipart.getCount(); i++) {
                Part sub = multipart.getBodyPart(i);
                if (Part.ATTACHMENT.equalsIgnoreCase(sub.getDisposition())) continue;
                String text = bodyText(sub);
                if (text.isEmpty()) continue;
                if (sub.isMimeType("text/html")) html = html == null ? text : html;
                else return text;
            }
            return html == null ? "" : html;
        }
        if (part.isMimeType("text/html")) {
            return String.valueOf(part.getContent()).replaceAll("(?s)<(script|style).*?</\1>", " ")
                    .replaceAll("<[^>]+>", " ").replaceAll("\s+", " ").trim();
        }
        return "";
    }

    private static String escape(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
