import { InsuranceType, UserRole, QuoteStatus } from './Common';

describe('Common Types', () => {
  describe('InsuranceType', () => {
    it('should have correct enum values', () => {
      expect(InsuranceType.AUTO).toBe('auto');
      expect(InsuranceType.HOME).toBe('home');
      expect(InsuranceType.LIFE).toBe('life');
      expect(InsuranceType.HEALTH).toBe('health');
      expect(InsuranceType.BUSINESS).toBe('business');
    });
  });

  describe('UserRole', () => {
    it('should have correct enum values', () => {
      expect(UserRole.CUSTOMER).toBe('customer');
      expect(UserRole.AGENT).toBe('agent');
      expect(UserRole.ADMIN).toBe('admin');
    });
  });

  describe('QuoteStatus', () => {
    it('should have correct enum values', () => {
      expect(QuoteStatus.DRAFT).toBe('draft');
      expect(QuoteStatus.ACTIVE).toBe('active');
      expect(QuoteStatus.EXPIRED).toBe('expired');
      expect(QuoteStatus.CONVERTED).toBe('converted');
      expect(QuoteStatus.DECLINED).toBe('declined');
    });
  });
});