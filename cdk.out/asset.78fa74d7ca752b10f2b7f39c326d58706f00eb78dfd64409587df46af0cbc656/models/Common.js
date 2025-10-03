"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuoteStatus = exports.UserRole = exports.InsuranceType = void 0;
var InsuranceType;
(function (InsuranceType) {
    InsuranceType["AUTO"] = "auto";
    InsuranceType["HOME"] = "home";
    InsuranceType["LIFE"] = "life";
    InsuranceType["HEALTH"] = "health";
    InsuranceType["BUSINESS"] = "business";
})(InsuranceType || (exports.InsuranceType = InsuranceType = {}));
var UserRole;
(function (UserRole) {
    UserRole["CUSTOMER"] = "customer";
    UserRole["AGENT"] = "agent";
    UserRole["ADMIN"] = "admin";
})(UserRole || (exports.UserRole = UserRole = {}));
var QuoteStatus;
(function (QuoteStatus) {
    QuoteStatus["DRAFT"] = "draft";
    QuoteStatus["ACTIVE"] = "active";
    QuoteStatus["EXPIRED"] = "expired";
    QuoteStatus["CONVERTED"] = "converted";
    QuoteStatus["DECLINED"] = "declined";
})(QuoteStatus || (exports.QuoteStatus = QuoteStatus = {}));
