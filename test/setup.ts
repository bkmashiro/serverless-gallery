// Import Jest types
import 'jest';

// Mock console methods to avoid noise in test output
global.console = {
    ...console,
    // Uncomment to see debug logs in test output
    // log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
}; 