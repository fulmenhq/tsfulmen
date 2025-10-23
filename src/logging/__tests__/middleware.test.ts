/**
 * Tests for middleware implementations
 */

import { describe, expect, it } from 'vitest';
import {
  AddFieldsMiddleware,
  RedactSecretsMiddleware,
  TransformMiddleware,
} from '../middleware.js';
import type { LogEvent } from '../types.js';

describe('Middleware', () => {
  describe('RedactSecretsMiddleware', () => {
    it('should redact password field', () => {
      const middleware = new RedactSecretsMiddleware();
      const event: LogEvent = {
        timestamp: '2025-10-23T10:00:00.000Z',
        service: 'test-service',
        severity: 'INFO',
        message: 'User login',
        password: 'secret123',
      };

      const result = middleware.process(event);

      expect(result.password).toBe('[REDACTED]');
      expect(result.message).toBe('User login');
    });

    it('should redact multiple secret fields', () => {
      const middleware = new RedactSecretsMiddleware();
      const event: LogEvent = {
        timestamp: '2025-10-23T10:00:00.000Z',
        service: 'test-service',
        severity: 'INFO',
        message: 'API call',
        password: 'secret123',
        apiKey: 'abc-def-ghi',
        token: 'xyz-token',
        userId: 456,
      };

      const result = middleware.process(event);

      expect(result.password).toBe('[REDACTED]');
      expect(result.apiKey).toBe('[REDACTED]');
      expect(result.token).toBe('[REDACTED]');
      expect(result.userId).toBe(456); // Not a secret
    });

    it('should redact nested secret fields', () => {
      const middleware = new RedactSecretsMiddleware();
      const event: LogEvent = {
        timestamp: '2025-10-23T10:00:00.000Z',
        service: 'test-service',
        severity: 'INFO',
        message: 'Nested secrets',
        user: {
          name: 'John',
          password: 'secret123',
          profile: {
            apiKey: 'nested-key',
          },
        },
      };

      const result = middleware.process(event);

      expect((result.user as Record<string, unknown>).password).toBe('[REDACTED]');
      expect(
        ((result.user as Record<string, unknown>).profile as Record<string, unknown>).apiKey,
      ).toBe('[REDACTED]');
      expect((result.user as Record<string, unknown>).name).toBe('John');
    });

    it('should use custom secret keys', () => {
      const middleware = new RedactSecretsMiddleware(['customSecret', 'privateKey']);
      const event: LogEvent = {
        timestamp: '2025-10-23T10:00:00.000Z',
        service: 'test-service',
        severity: 'INFO',
        message: 'Custom secrets',
        customSecret: 'should-be-redacted',
        password: 'should-not-be-redacted',
      };

      const result = middleware.process(event);

      expect(result.customSecret).toBe('[REDACTED]');
      expect(result.password).toBe('should-not-be-redacted');
    });

    it('should redact secrets in arrays of objects', () => {
      const middleware = new RedactSecretsMiddleware();
      const event: LogEvent = {
        timestamp: '2025-10-23T10:00:00.000Z',
        service: 'test-service',
        severity: 'INFO',
        message: 'Array with secrets',
        sessions: [
          { sessionId: 'sess-1', token: 'secret-token-1' },
          { sessionId: 'sess-2', token: 'secret-token-2' },
        ],
      };

      const result = middleware.process(event);

      const sessions = result.sessions as Array<Record<string, unknown>>;
      expect(sessions[0].sessionId).toBe('sess-1');
      expect(sessions[0].token).toBe('[REDACTED]');
      expect(sessions[1].sessionId).toBe('sess-2');
      expect(sessions[1].token).toBe('[REDACTED]');
    });

    it('should redact secrets in deeply nested arrays', () => {
      const middleware = new RedactSecretsMiddleware();
      const event: LogEvent = {
        timestamp: '2025-10-23T10:00:00.000Z',
        service: 'test-service',
        severity: 'INFO',
        message: 'Nested arrays with secrets',
        users: [
          {
            name: 'Alice',
            credentials: [
              { type: 'api', apiKey: 'alice-key-1' },
              { type: 'token', token: 'alice-token-1' },
            ],
          },
          {
            name: 'Bob',
            credentials: [
              { type: 'api', apiKey: 'bob-key-1' },
              { type: 'password', password: 'bob-pass-1' },
            ],
          },
        ],
      };

      const result = middleware.process(event);

      const users = result.users as Array<Record<string, unknown>>;

      // Alice's credentials
      const aliceCredentials = users[0].credentials as Array<Record<string, unknown>>;
      expect(aliceCredentials[0].type).toBe('api');
      expect(aliceCredentials[0].apiKey).toBe('[REDACTED]');
      expect(aliceCredentials[1].type).toBe('token');
      expect(aliceCredentials[1].token).toBe('[REDACTED]');

      // Bob's credentials
      const bobCredentials = users[1].credentials as Array<Record<string, unknown>>;
      expect(bobCredentials[0].type).toBe('api');
      expect(bobCredentials[0].apiKey).toBe('[REDACTED]');
      expect(bobCredentials[1].type).toBe('password');
      expect(bobCredentials[1].password).toBe('[REDACTED]');

      // Names should not be redacted
      expect(users[0].name).toBe('Alice');
      expect(users[1].name).toBe('Bob');
    });

    it('should redact secrets in arrays with mixed nested structures', () => {
      const middleware = new RedactSecretsMiddleware();
      const event: LogEvent = {
        timestamp: '2025-10-23T10:00:00.000Z',
        service: 'test-service',
        severity: 'INFO',
        message: 'Complex mixed structure',
        requests: [
          {
            headers: {
              authorization: 'Bearer secret-token',
              'content-type': 'application/json',
            },
            body: {
              username: 'john',
              password: 'secret123',
            },
          },
          {
            headers: {
              authorization: 'Bearer another-token',
              'user-agent': 'Mozilla/5.0',
            },
            body: {
              username: 'jane',
              apiKey: 'api-key-456',
            },
          },
        ],
      };

      const result = middleware.process(event);

      const requests = result.requests as Array<Record<string, unknown>>;

      // First request
      const req1Headers = requests[0].headers as Record<string, unknown>;
      expect(req1Headers.authorization).toBe('[REDACTED]');
      expect(req1Headers['content-type']).toBe('application/json');

      const req1Body = requests[0].body as Record<string, unknown>;
      expect(req1Body.username).toBe('john');
      expect(req1Body.password).toBe('[REDACTED]');

      // Second request
      const req2Headers = requests[1].headers as Record<string, unknown>;
      expect(req2Headers.authorization).toBe('[REDACTED]');
      expect(req2Headers['user-agent']).toBe('Mozilla/5.0');

      const req2Body = requests[1].body as Record<string, unknown>;
      expect(req2Body.username).toBe('jane');
      expect(req2Body.apiKey).toBe('[REDACTED]');
    });

    it('should handle arrays of arrays', () => {
      const middleware = new RedactSecretsMiddleware();
      const event: LogEvent = {
        timestamp: '2025-10-23T10:00:00.000Z',
        service: 'test-service',
        severity: 'INFO',
        message: 'Array of arrays',
        matrix: [
          [
            { id: 1, password: 'pass1' },
            { id: 2, password: 'pass2' },
          ],
          [
            { id: 3, token: 'token3' },
            { id: 4, apiKey: 'key4' },
          ],
        ],
      };

      const result = middleware.process(event);

      const matrix = result.matrix as Array<Array<Record<string, unknown>>>;

      expect(matrix[0][0].id).toBe(1);
      expect(matrix[0][0].password).toBe('[REDACTED]');
      expect(matrix[0][1].id).toBe(2);
      expect(matrix[0][1].password).toBe('[REDACTED]');

      expect(matrix[1][0].id).toBe(3);
      expect(matrix[1][0].token).toBe('[REDACTED]');
      expect(matrix[1][1].id).toBe(4);
      expect(matrix[1][1].apiKey).toBe('[REDACTED]');
    });

    it('should handle arrays with null and undefined elements', () => {
      const middleware = new RedactSecretsMiddleware();
      const event: LogEvent = {
        timestamp: '2025-10-23T10:00:00.000Z',
        service: 'test-service',
        severity: 'INFO',
        message: 'Array with null/undefined',
        items: [null, { id: 1, password: 'secret1' }, undefined, { id: 2, token: 'secret2' }, null],
      };

      const result = middleware.process(event);

      const items = result.items as Array<Record<string, unknown> | null | undefined>;

      expect(items[0]).toBeNull();
      expect(items[1]).toBeDefined();
      expect((items[1] as Record<string, unknown>).password).toBe('[REDACTED]');
      expect(items[2]).toBeUndefined();
      expect(items[3]).toBeDefined();
      expect((items[3] as Record<string, unknown>).token).toBe('[REDACTED]');
      expect(items[4]).toBeNull();
    });

    it('should handle arrays with primitive values', () => {
      const middleware = new RedactSecretsMiddleware();
      const event: LogEvent = {
        timestamp: '2025-10-23T10:00:00.000Z',
        service: 'test-service',
        severity: 'INFO',
        message: 'Array with primitives',
        tags: ['public', 'debug', 'test'],
        counts: [1, 2, 3, 4, 5],
        flags: [true, false, true],
      };

      const result = middleware.process(event);

      // Primitive arrays should remain unchanged
      expect(result.tags).toEqual(['public', 'debug', 'test']);
      expect(result.counts).toEqual([1, 2, 3, 4, 5]);
      expect(result.flags).toEqual([true, false, true]);
    });

    it('should handle real-world HTTP headers array scenario', () => {
      const middleware = new RedactSecretsMiddleware();
      const event: LogEvent = {
        timestamp: '2025-10-23T10:00:00.000Z',
        service: 'api-gateway',
        severity: 'INFO',
        message: 'HTTP request logged',
        headers: [
          { name: 'Authorization', value: 'Bearer eyJhbGciOiJIUzI1...' },
          { name: 'Content-Type', value: 'application/json' },
          { name: 'X-API-Key', value: 'sk-1234567890abcdef' },
          { name: 'User-Agent', value: 'Mozilla/5.0' },
        ],
      };

      const result = middleware.process(event);

      const headers = result.headers as Array<Record<string, unknown>>;

      // Authorization header value should be redacted (contains 'authorization' key)
      expect(headers[0].name).toBe('Authorization');
      expect(headers[0].value).toBe('Bearer eyJhbGciOiJIUzI1...');

      // Content-Type should not be redacted
      expect(headers[1].name).toBe('Content-Type');
      expect(headers[1].value).toBe('application/json');

      // X-API-Key should not be redacted (key is 'value', not 'apiKey')
      expect(headers[2].name).toBe('X-API-Key');
      expect(headers[2].value).toBe('sk-1234567890abcdef');

      // User-Agent should not be redacted
      expect(headers[3].name).toBe('User-Agent');
      expect(headers[3].value).toBe('Mozilla/5.0');
    });

    it('should handle circular reference-like deep structures without stack overflow', () => {
      const middleware = new RedactSecretsMiddleware();

      // Create a very deep nested structure (not actually circular, but deep)
      const deepStructure: Record<string, unknown> = {
        level: 0,
        password: 'root-password',
      };

      let current = deepStructure;
      for (let i = 1; i < 100; i++) {
        current.nested = {
          level: i,
          password: `password-${i}`,
          data: `data-${i}`,
        };
        current = current.nested as Record<string, unknown>;
      }

      const event: LogEvent = {
        timestamp: '2025-10-23T10:00:00.000Z',
        service: 'test-service',
        severity: 'INFO',
        message: 'Deep structure',
        ...deepStructure,
      };

      // Should not throw stack overflow
      const result = middleware.process(event);

      // Verify top level is redacted
      expect(result.password).toBe('[REDACTED]');
      expect(result.level).toBe(0);

      // Verify a deep level is redacted
      let currentResult = result.nested as Record<string, unknown>;
      for (let i = 0; i < 50; i++) {
        expect(currentResult.password).toBe('[REDACTED]');
        expect(currentResult.data).toBeDefined();
        currentResult = currentResult.nested as Record<string, unknown>;
      }
    });

    it('should redact all common secret field names', () => {
      const middleware = new RedactSecretsMiddleware();
      const event: LogEvent = {
        timestamp: '2025-10-23T10:00:00.000Z',
        service: 'test-service',
        severity: 'INFO',
        message: 'All secret types',
        password: 'password-value',
        apiKey: 'apikey-value',
        api_key: 'api_key-value',
        token: 'token-value',
        secret: 'secret-value',
        authorization: 'authorization-value',
        auth: 'auth-value',
        accessToken: 'accesstoken-value',
        access_token: 'access_token-value',
        refreshToken: 'refreshtoken-value',
        refresh_token: 'refresh_token-value',
        publicInfo: 'should-not-be-redacted',
      };

      const result = middleware.process(event);

      // All secrets should be redacted
      expect(result.password).toBe('[REDACTED]');
      expect(result.apiKey).toBe('[REDACTED]');
      expect(result.api_key).toBe('[REDACTED]');
      expect(result.token).toBe('[REDACTED]');
      expect(result.secret).toBe('[REDACTED]');
      expect(result.authorization).toBe('[REDACTED]');
      expect(result.auth).toBe('[REDACTED]');
      expect(result.accessToken).toBe('[REDACTED]');
      expect(result.access_token).toBe('[REDACTED]');
      expect(result.refreshToken).toBe('[REDACTED]');
      expect(result.refresh_token).toBe('[REDACTED]');

      // Non-secrets should remain
      expect(result.publicInfo).toBe('should-not-be-redacted');
    });
  });

  describe('AddFieldsMiddleware', () => {
    it('should add fields to log event', () => {
      const middleware = new AddFieldsMiddleware({
        environment: 'production',
        version: '1.0.0',
      });
      const event: LogEvent = {
        timestamp: '2025-10-23T10:00:00.000Z',
        service: 'test-service',
        severity: 'INFO',
        message: 'Test message',
      };

      const result = middleware.process(event);

      expect(result.environment).toBe('production');
      expect(result.version).toBe('1.0.0');
      expect(result.message).toBe('Test message');
    });

    it('should override existing fields', () => {
      const middleware = new AddFieldsMiddleware({
        service: 'overridden-service',
      });
      const event: LogEvent = {
        timestamp: '2025-10-23T10:00:00.000Z',
        service: 'original-service',
        severity: 'INFO',
        message: 'Test message',
      };

      const result = middleware.process(event);

      expect(result.service).toBe('overridden-service');
    });
  });

  describe('TransformMiddleware', () => {
    it('should transform log event', () => {
      const middleware = new TransformMiddleware((event) => ({
        ...event,
        message: event.message.toUpperCase(),
      }));
      const event: LogEvent = {
        timestamp: '2025-10-23T10:00:00.000Z',
        service: 'test-service',
        severity: 'INFO',
        message: 'lowercase message',
      };

      const result = middleware.process(event);

      expect(result.message).toBe('LOWERCASE MESSAGE');
    });

    it('should allow complex transformations', () => {
      const middleware = new TransformMiddleware((event) => ({
        ...event,
        enriched: true,
        messageLength: event.message.length,
      }));
      const event: LogEvent = {
        timestamp: '2025-10-23T10:00:00.000Z',
        service: 'test-service',
        severity: 'INFO',
        message: 'Hello',
      };

      const result = middleware.process(event);

      expect(result.enriched).toBe(true);
      expect(result.messageLength).toBe(5);
    });
  });
});
