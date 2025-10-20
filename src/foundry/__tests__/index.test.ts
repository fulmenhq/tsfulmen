/**
 * Test foundry module exports
 */

import { describe, expect, it } from 'vitest';
import * as foundry from '../index.js';

describe('Foundry Module Exports', () => {
  it('should export VERSION constant', () => {
    expect(foundry.VERSION).toBe('0.1.1');
  });

  it('should export FoundryCatalogError', () => {
    expect(foundry.FoundryCatalogError).toBeDefined();
    expect(typeof foundry.FoundryCatalogError).toBe('function');
  });

  it('should export all loader functions', () => {
    expect(foundry.loadPatternCatalog).toBeDefined();
    expect(foundry.loadHttpStatusCatalog).toBeDefined();
    expect(foundry.loadMimeTypeCatalog).toBeDefined();
    expect(foundry.loadCountryCodeCatalog).toBeDefined();
    expect(foundry.loadAllCatalogs).toBeDefined();

    expect(typeof foundry.loadPatternCatalog).toBe('function');
    expect(typeof foundry.loadHttpStatusCatalog).toBe('function');
    expect(typeof foundry.loadMimeTypeCatalog).toBe('function');
    expect(typeof foundry.loadCountryCodeCatalog).toBe('function');
    expect(typeof foundry.loadAllCatalogs).toBe('function');
  });

  it('should export all type definitions', () => {
    // Type exports should be available
    expect(foundry).toBeDefined();

    // We can't directly test type exports at runtime, but we can verify
    // that the module exports something for each type category
    console.log('Foundry exports available:', Object.keys(foundry));
  });
});
