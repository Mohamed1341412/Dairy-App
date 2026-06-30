// pb_hooks/services/reference_number_service.pb.js

/**
 * Service to generate unique reference numbers for business documents.
 */
const ReferenceNumberService = {
  /**
   * Generates a simple, unique reference number.
   * Format: PREFIX-YYYYMMDD-RANDOM
   * @param {string} prefix - e.g., 'SO', 'PO', 'TR'
   */
  generate: (prefix) => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    // Generate a much longer random string (e.g., 10 alphanumeric characters)
    const random = Math.random().toString(36).substring(2, 12).toUpperCase();
    return `${prefix}-${date}-${random}`;
  },
};

module.exports = ReferenceNumberService;
