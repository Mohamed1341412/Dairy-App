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
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(1000 + Math.random() * 9000); // 4 random digits
    return `${prefix}-${date}-${random}`;
  }
};

module.exports = ReferenceNumberService;
