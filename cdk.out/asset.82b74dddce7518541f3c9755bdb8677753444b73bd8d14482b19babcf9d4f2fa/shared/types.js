"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuoteStatus = exports.InsuranceType = void 0;
var InsuranceType;
(function (InsuranceType) {
    InsuranceType["AUTO"] = "auto";
    InsuranceType["HOME"] = "home";
    InsuranceType["LIFE"] = "life";
    InsuranceType["HEALTH"] = "health";
})(InsuranceType || (exports.InsuranceType = InsuranceType = {}));
var QuoteStatus;
(function (QuoteStatus) {
    QuoteStatus["DRAFT"] = "draft";
    QuoteStatus["ACTIVE"] = "active";
    QuoteStatus["EXPIRED"] = "expired";
    QuoteStatus["CONVERTED"] = "converted";
})(QuoteStatus || (exports.QuoteStatus = QuoteStatus = {}));
