// pb_hooks/services/event_logger.pb.js

// Currently writes to PocketBase internal logger ($app.logger().info())
// External file logging (desktop/logs/) is NOT implemented in MVP.
// This is a planned enhancement for future versions.
/**
 * System Event Logger Service
 * Tracks what happens IN the system (e.g., auto-recalculations, scheduled tasks).
 * Distinct from Audit Logger (who did what).
 */
const EventLogger = {
  log: (event, details = {}) => {
    try {
      if (typeof $app !== "undefined") {
        $app
          .logger()
          .info(
            `[EVENT] ${event}`,
            "details",
            JSON.stringify(details),
            "timestamp",
            new Date().toISOString(),
          );
      }
    } catch (err) {
      // Fail-safe
    }
  },
};

module.exports = EventLogger;
