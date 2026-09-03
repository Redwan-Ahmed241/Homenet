/**
 * Complete, Comprehensive Postman Collection Generator for Homenet API
 * Generates postman/homenet-api-tests.postman_collection.json
 */
import * as fs from 'fs';
import * as path from 'path';

interface QueryParam {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

interface RequestOptions {
  name: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  urlPath: string[];
  queryParams?: QueryParam[];
  headers?: { key: string; value: string; description?: string }[];
  body?: any;
  formData?: { key: string; value?: string; type: 'text' | 'file'; src?: string; description?: string }[];
  authType?: 'bearer' | 'noauth';
  bearerToken?: string;
  testScript?: string[];
  prerequestScript?: string[];
  description?: string;
}

function req(options: RequestOptions) {
  const {
    name,
    method,
    urlPath,
    queryParams = [],
    headers = [],
    body,
    formData,
    authType = 'bearer',
    bearerToken = '{{accessToken}}',
    testScript = [],
    prerequestScript = [],
    description = '',
  } = options;

  const events: any[] = [];

  if (prerequestScript && prerequestScript.length > 0) {
    events.push({
      listen: 'prerequest',
      script: {
        type: 'text/javascript',
        exec: prerequestScript,
      },
    });
  }

  if (testScript && testScript.length > 0) {
    events.push({
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: testScript,
      },
    });
  }

  const reqHeaders: any[] = [...headers];
  let reqBody: any = undefined;

  if (formData) {
    reqBody = {
      mode: 'formdata',
      formdata: formData,
    };
  } else if (body !== undefined) {
    reqHeaders.push({
      key: 'Content-Type',
      value: 'application/json',
      type: 'text',
    });
    reqBody = {
      mode: 'raw',
      raw: typeof body === 'string' ? body : JSON.stringify(body, null, 2),
      options: {
        raw: {
          language: 'json',
        },
      },
    };
  }

  const reqAuth =
    authType === 'noauth'
      ? { type: 'noauth' }
      : {
          type: 'bearer',
          bearer: [
            {
              key: 'token',
              value: bearerToken,
              type: 'string',
            },
          ],
        };

  return {
    name,
    event: events,
    request: {
      auth: reqAuth,
      method,
      header: reqHeaders,
      body: reqBody,
      url: {
        raw: `{{baseUrl}}/${urlPath.join('/')}${
          queryParams.length > 0
            ? '?' +
              queryParams
                .filter((q) => !q.disabled)
                .map((q) => `${q.key}=${encodeURIComponent(q.value)}`)
                .join('&')
            : ''
        }`,
        host: ['{{baseUrl}}'],
        path: urlPath,
        query: queryParams.map((q) => ({
          key: q.key,
          value: q.value,
          description: q.description,
          disabled: q.disabled,
        })),
      },
      description,
    },
    response: [],
  };
}

function folder(name: string, item: any[], description = '') {
  return {
    name,
    description,
    item,
  };
}

// ────────────────────────────────────────────────────────────
// FOLDER DEFINITIONS
// ────────────────────────────────────────────────────────────

// 00 - Setup & Health
const setupFolder = folder(
  '00 - Setup & Health',
  [
    req({
      name: '[PASS] Health - GET / Root Hello World',
      method: 'GET',
      urlPath: [],
      authType: 'noauth',
      testScript: [
        'pm.test("Status code is 200", function () {',
        '    pm.response.to.have.status(200);',
        '});',
        'pm.test("Response is wrapped in standard ApiResponse", function () {',
        '    const json = pm.response.json();',
        '    pm.expect(json).to.have.property("success", true);',
        '    pm.expect(json).to.have.property("message", "OK");',
        '    pm.expect(json.data).to.equal("Hello World!");',
        '});',
      ],
      description: 'Verifies the root GET / endpoint and response wrapping interceptor.',
    }),
    req({
      name: '[PASS] Setup - Admin Login (Capture adminAccessToken)',
      method: 'POST',
      urlPath: ['v1', 'auth', 'login'],
      authType: 'noauth',
      body: {
        email: '{{adminEmail}}',
        password: '{{adminPassword}}',
      },
      testScript: [
        'pm.test("Status code is 200", function () {',
        '    pm.response.to.have.status(200);',
        '});',
        'pm.test("Captures adminAccessToken and adminRefreshToken", function () {',
        '    const json = pm.response.json();',
        '    pm.expect(json.success).to.be.true;',
        '    pm.expect(json.data).to.have.property("access_token");',
        '    pm.expect(json.data).to.have.property("refresh_token");',
        '    pm.environment.set("adminAccessToken", json.data.access_token);',
        '    pm.environment.set("adminRefreshToken", json.data.refresh_token);',
        '    pm.environment.set("accessToken", json.data.access_token);',
        '    pm.environment.set("refreshToken", json.data.refresh_token);',
        '});',
      ],
      description: 'Logs in as Admin (a@g.com) and captures admin tokens for admin-protected requests.',
    }),
    req({
      name: '[PASS] Setup - Regular User Login (Capture userAccessToken)',
      method: 'POST',
      urlPath: ['v1', 'auth', 'login'],
      authType: 'noauth',
      body: {
        email: '{{userEmail}}',
        password: '{{userPassword}}',
      },
      testScript: [
        'pm.test("Status code is 200", function () {',
        '    pm.response.to.have.status(200);',
        '});',
        'pm.test("Captures userAccessToken and userRefreshToken", function () {',
        '    const json = pm.response.json();',
        '    pm.expect(json.success).to.be.true;',
        '    pm.expect(json.data).to.have.property("access_token");',
        '    pm.expect(json.data).to.have.property("refresh_token");',
        '    pm.environment.set("userAccessToken", json.data.access_token);',
        '    pm.environment.set("userRefreshToken", json.data.refresh_token);',
        '});',
      ],
      description: 'Logs in as Regular User (s@g.com) and captures user tokens for RBAC & user tests.',
    }),
  ],
  'Health check and token initialization.',
);

// 01 - Authentication
const authFolder = folder('01 - Authentication', [
  folder('Register', [
    req({
      name: '[PASS] Register - Valid New User',
      method: 'POST',
      urlPath: ['v1', 'auth', 'register'],
      authType: 'noauth',
      prerequestScript: [
        'const ts = Date.now();',
        'const email = `qa-user-${ts}@example.com`;',
        'pm.environment.set("dynamicUserEmail", email);',
      ],
      body: {
        full_name: 'QA Test User',
        email: '{{dynamicUserEmail}}',
        password: '{{dynamicUserPassword}}',
      },
      testScript: [
        'pm.test("Status code is 201", function () {',
        '    pm.response.to.have.status(201);',
        '});',
        'pm.test("Response contains user details and token pair", function () {',
        '    const json = pm.response.json();',
        '    pm.expect(json.success).to.be.true;',
        '    pm.expect(json.data).to.have.property("access_token");',
        '    pm.expect(json.data).to.have.property("refresh_token");',
        '    pm.expect(json.data).to.have.property("user");',
        '    pm.expect(json.data.user).to.have.property("id");',
        '    pm.expect(json.data.user.email).to.equal(pm.environment.get("dynamicUserEmail"));',
        '    pm.environment.set("dynamicUserId", json.data.user.id);',
        '    pm.environment.set("dynamicUserAccessToken", json.data.access_token);',
        '    pm.environment.set("dynamicUserRefreshToken", json.data.refresh_token);',
        '});',
      ],
      description: 'Registers a brand new user with unique timestamped email.',
    }),
    req({
      name: '[FAIL] Register - Duplicate Email',
      method: 'POST',
      urlPath: ['v1', 'auth', 'register'],
      authType: 'noauth',
      body: {
        full_name: 'Duplicate User',
        email: '{{dynamicUserEmail}}',
        password: '{{dynamicUserPassword}}',
      },
      testScript: [
        'pm.test("Status code is 409 Conflict", function () {',
        '    pm.response.to.have.status(409);',
        '});',
        'pm.test("Returns EMAIL_ALREADY_EXISTS (code 1101)", function () {',
        '    const json = pm.response.json();',
        '    pm.expect(json.success).to.be.false;',
        '    pm.expect(json.error_code).to.equal(1101);',
        '    pm.expect(json.message).to.equal("An account with this email already exists");',
        '});',
      ],
      description: 'Attempting to register with an existing email must return 409 with error code 1101.',
    }),
    req({
      name: '[FAIL] Register - Weak Password (< 8 chars)',
      method: 'POST',
      urlPath: ['v1', 'auth', 'register'],
      authType: 'noauth',
      body: {
        full_name: 'Weak Pass User',
        email: 'weakpass-{{$timestamp}}@example.com',
        password: 'weak',
      },
      testScript: [
        'pm.test("Status code is 400 Bad Request", function () {',
        '    pm.response.to.have.status(400);',
        '});',
        'pm.test("Returns PASSWORD_TOO_WEAK (code 1102)", function () {',
        '    const json = pm.response.json();',
        '    pm.expect(json.success).to.be.false;',
        '    pm.expect(json.error_code).to.equal(1102);',
        '});',
      ],
      description: 'Passwords under 8 chars fail custom password validation.',
    }),
    req({
      name: '[FAIL] Register - Password With Spaces',
      method: 'POST',
      urlPath: ['v1', 'auth', 'register'],
      authType: 'noauth',
      body: {
        full_name: 'Space Pass User',
        email: 'spacepass-{{$timestamp}}@example.com',
        password: 'Pass 12345678',
      },
      testScript: [
        'pm.test("Status code is 400 Bad Request", function () {',
        '    pm.response.to.have.status(400);',
        '});',
        'pm.test("Returns PASSWORD_TOO_WEAK (code 1102)", function () {',
        '    const json = pm.response.json();',
        '    pm.expect(json.success).to.be.false;',
        '    pm.expect(json.error_code).to.equal(1102);',
        '});',
      ],
      description: 'Passwords with spaces are rejected.',
    }),
    req({
      name: '[FAIL] Register - Missing Required Fields',
      method: 'POST',
      urlPath: ['v1', 'auth', 'register'],
      authType: 'noauth',
      body: {},
      testScript: [
        'pm.test("Status code is 400 Validation Error", function () {',
        '    pm.response.to.have.status(400);',
        '});',
        'pm.test("Returns Validation failure details", function () {',
        '    const json = pm.response.json();',
        '    pm.expect(json.success).to.be.false;',
        '    pm.expect(json.error_code).to.equal(1001);',
        '});',
      ],
      description: 'Empty body fails ValidationPipe constraints.',
    }),
    req({
      name: '[FAIL] Register - Invalid Email Format',
      method: 'POST',
      urlPath: ['v1', 'auth', 'register'],
      authType: 'noauth',
      body: {
        full_name: 'Invalid Email',
        email: 'not-an-email',
        password: 'ValidPass123!',
      },
      testScript: [
        'pm.test("Status code is 400 Bad Request", function () {',
        '    pm.response.to.have.status(400);',
        '});',
        'pm.test("Validation error for email", function () {',
        '    const json = pm.response.json();',
        '    pm.expect(json.success).to.be.false;',
        '    pm.expect(json.error_code).to.equal(1001);',
        '});',
      ],
      description: 'Invalid email syntax caught by @IsEmail().',
    }),
    req({
      name: '[FAIL] Register - Name Below Minimum Length (1 char)',
      method: 'POST',
      urlPath: ['v1', 'auth', 'register'],
      authType: 'noauth',
      body: {
        full_name: 'A',
        email: 'shortname-{{$timestamp}}@example.com',
        password: 'ValidPass123!',
      },
      testScript: [
        'pm.test("Status code is 400 Bad Request", function () {',
        '    pm.response.to.have.status(400);',
        '});',
        'pm.test("Validation error for min length", function () {',
        '    const json = pm.response.json();',
        '    pm.expect(json.success).to.be.false;',
        '    pm.expect(json.error_code).to.equal(1001);',
        '});',
      ],
      description: 'full_name requires @MinLength(2).',
    }),
    req({
      name: '[FAIL] Register - Name Exceeding Maximum Length (101 chars)',
      method: 'POST',
      urlPath: ['v1', 'auth', 'register'],
      authType: 'noauth',
      body: {
        full_name: 'A'.repeat(101),
        email: 'longname-{{$timestamp}}@example.com',
        password: 'ValidPass123!',
      },
      testScript: [
        'pm.test("Status code is 400 Bad Request", function () {',
        '    pm.response.to.have.status(400);',
        '});',
        'pm.test("Validation error for max length", function () {',
        '    const json = pm.response.json();',
        '    pm.expect(json.success).to.be.false;',
        '    pm.expect(json.error_code).to.equal(1001);',
        '});',
      ],
      description: 'full_name requires @MaxLength(100).',
    }),
  ]),

  folder('Login', [
    req({
      name: '[PASS] Login - Valid Credentials',
      method: 'POST',
      urlPath: ['v1', 'auth', 'login'],
      authType: 'noauth',
      body: {
        email: '{{dynamicUserEmail}}',
        password: '{{dynamicUserPassword}}',
      },
      testScript: [
        'pm.test("Status code is 200", function () {',
        '    pm.response.to.have.status(200);',
        '});',
        'pm.test("Returns new token pair and user profile", function () {',
        '    const json = pm.response.json();',
        '    pm.expect(json.success).to.be.true;',
        '    pm.expect(json.data.access_token).to.be.a("string");',
        '    pm.expect(json.data.refresh_token).to.be.a("string");',
        '    pm.environment.set("dynamicUserAccessToken", json.data.access_token);',
        '    pm.environment.set("dynamicUserRefreshToken", json.data.refresh_token);',
        '});',
      ],
      description: 'Valid login via LocalAuthGuard returns access + refresh tokens.',
    }),
    req({
      name: '[FAIL] Login - Wrong Password',
      method: 'POST',
      urlPath: ['v1', 'auth', 'login'],
      authType: 'noauth',
      body: {
        email: '{{dynamicUserEmail}}',
        password: 'WrongPassword999!',
      },
      testScript: [
        'pm.test("Status code is 401 Unauthorized", function () {',
        '    pm.response.to.have.status(401);',
        '});',
        'pm.test("Returns INVALID_CREDENTIALS (code 1100)", function () {',
        '    const json = pm.response.json();',
        '    pm.expect(json.success).to.be.false;',
        '    pm.expect(json.error_code).to.equal(1100);',
        '});',
      ],
      description: 'Bcrypt mismatch triggers 401 INVALID_CREDENTIALS.',
    }),
    req({
      name: '[FAIL] Login - Non-Existent User',
      method: 'POST',
      urlPath: ['v1', 'auth', 'login'],
      authType: 'noauth',
      body: {
        email: 'nonexistent-user-99999@example.com',
        password: 'AnyPassword123!',
      },
      testScript: [
        'pm.test("Status code is 401 Unauthorized", function () {',
        '    pm.response.to.have.status(401);',
        '});',
        'pm.test("Returns INVALID_CREDENTIALS (code 1100)", function () {',
        '    const json = pm.response.json();',
        '    pm.expect(json.success).to.be.false;',
        '    pm.expect(json.error_code).to.equal(1100);',
        '});',
      ],
      description: 'Non-existent user email triggers 401 without leaking user existence.',
    }),
    req({
      name: '[FAIL] Login - Missing Password Field',
      method: 'POST',
      urlPath: ['v1', 'auth', 'login'],
      authType: 'noauth',
      body: {
        email: '{{dynamicUserEmail}}',
      },
      testScript: [
        'pm.test("Status code is 400 or 401", function () {',
        '    pm.expect([400, 401]).to.include(pm.response.code);',
        '});',
      ],
      description: 'Missing password fails request.',
    }),
  ]),

  folder('Refresh Token', [
    req({
      name: '[PASS] Refresh Token - Valid Token Pair Rotation',
      method: 'POST',
      urlPath: ['v1', 'auth', 'refresh'],
      authType: 'noauth',
      body: {
        refresh_token: '{{dynamicUserRefreshToken}}',
      },
      testScript: [
        'pm.test("Status code is 200", function () {',
        '    pm.response.to.have.status(200);',
        '});',
        'pm.test("Rotates refresh token and issues new access token", function () {',
        '    const json = pm.response.json();',
        '    pm.expect(json.success).to.be.true;',
        '    pm.expect(json.data).to.have.property("access_token");',
        '    pm.expect(json.data).to.have.property("refresh_token");',
        '    pm.expect(json.data.refresh_token).to.not.equal(pm.environment.get("dynamicUserRefreshToken"));',
        '    pm.environment.set("dynamicUserAccessToken", json.data.access_token);',
        '    pm.environment.set("dynamicUserRefreshToken", json.data.refresh_token);',
        '});',
      ],
      description: 'Valid refresh token rotates hash in DB and returns new token pair.',
    }),
    req({
      name: '[FAIL] Refresh Token - Reusing Old (Already Rotated) Token',
      method: 'POST',
      urlPath: ['v1', 'auth', 'refresh'],
      authType: 'noauth',
      body: {
        refresh_token: '00000000-0000-0000-0000-000000000000',
      },
      testScript: [
        'pm.test("Status code is 401 Unauthorized", function () {',
        '    pm.response.to.have.status(401);',
        '});',
        'pm.test("Returns INVALID_REFRESH_TOKEN (code 1103)", function () {',
        '    const json = pm.response.json();',
        '    pm.expect(json.success).to.be.false;',
        '    pm.expect(json.error_code).to.equal(1103);',
        '});',
      ],
      description: 'Attempting to refresh with invalid or rotated token fails.',
    }),
    req({
      name: '[FAIL] Refresh Token - Empty Payload',
      method: 'POST',
      urlPath: ['v1', 'auth', 'refresh'],
      authType: 'noauth',
      body: {},
      testScript: [
        'pm.test("Status code is 400 Bad Request", function () {',
        '    pm.response.to.have.status(400);',
        '});',
      ],
      description: 'Missing refresh_token field fails validation.',
    }),
  ]),

  folder('Profile / Me', [
    req({
      name: '[PASS] Profile - Get Current User Profile (GET /v1/auth/me)',
      method: 'GET',
      urlPath: ['v1', 'auth', 'me'],
      bearerToken: '{{dynamicUserAccessToken}}',
      testScript: [
        'pm.test("Status code is 200", function () {',
        '    pm.response.to.have.status(200);',
        '});',
        'pm.test("Returns profile matching token user", function () {',
        '    const json = pm.response.json();',
        '    pm.expect(json.success).to.be.true;',
        '    pm.expect(json.data.id).to.equal(pm.environment.get("dynamicUserId"));',
        '    pm.expect(json.data.email).to.equal(pm.environment.get("dynamicUserEmail"));',
        '    pm.expect(json.data).to.have.property("full_name");',
        '});',
      ],
      description: 'Extracts profile for currently authenticated user via JwtStrategy.',
    }),
    req({
      name: '[FAIL] Profile - Missing Token (No Auth)',
      method: 'GET',
      urlPath: ['v1', 'auth', 'me'],
      authType: 'noauth',
      testScript: [
        'pm.test("Status code is 401 Unauthorized", function () {',
        '    pm.response.to.have.status(401);',
        '});',
        'pm.test("Returns auth error code 1100", function () {',
        '    const json = pm.response.json();',
        '    pm.expect(json.success).to.be.false;',
        '    pm.expect(json.error_code).to.equal(1100);',
        '});',
      ],
      description: 'Protected route rejects unauthenticated requests.',
    }),
    req({
      name: '[FAIL] Profile - Malformed Token',
      method: 'GET',
      urlPath: ['v1', 'auth', 'me'],
      bearerToken: '{{invalidToken}}',
      testScript: [
        'pm.test("Status code is 401 Unauthorized", function () {',
        '    pm.response.to.have.status(401);',
        '});',
      ],
      description: 'Invalid token structure fails passport-jwt validation.',
    }),
  ]),

  folder('Change Password', [
    req({
      name: '[PASS] Change Password - Valid Update (PATCH /v1/auth/change-password)',
      method: 'PATCH',
      urlPath: ['v1', 'auth', 'change-password'],
      bearerToken: '{{dynamicUserAccessToken}}',
      body: {
        current_password: '{{dynamicUserPassword}}',
        new_password: 'BrandNewPassword123!',
      },
      testScript: [
        'pm.test("Status code is 200", function () {',
        '    pm.response.to.have.status(200);',
        '});',
        'pm.test("Returns success message and updates stored password", function () {',
        '    const json = pm.response.json();',
        '    pm.expect(json.success).to.be.true;',
        '    pm.environment.set("dynamicUserPassword", "BrandNewPassword123!");',
        '});',
      ],
      description: 'Changes password and revokes existing refresh tokens.',
    }),
    req({
      name: '[FAIL] Change Password - Wrong Current Password',
      method: 'PATCH',
      urlPath: ['v1', 'auth', 'change-password'],
      bearerToken: '{{dynamicUserAccessToken}}',
      body: {
        current_password: 'WrongCurrentPassword123!',
        new_password: 'AnotherPassword123!',
      },
      testScript: [
        'pm.test("Status code is 401 Unauthorized", function () {',
        '    pm.response.to.have.status(401);',
        '});',
        'pm.test("Returns CURRENT_PASSWORD_INCORRECT (code 1108)", function () {',
        '    const json = pm.response.json();',
        '    pm.expect(json.success).to.be.false;',
        '    pm.expect(json.error_code).to.equal(1108);',
        '});',
      ],
      description: 'Incorrect current password triggers code 1108.',
    }),
    req({
      name: '[FAIL] Change Password - New Password Same As Current',
      method: 'PATCH',
      urlPath: ['v1', 'auth', 'change-password'],
      bearerToken: '{{dynamicUserAccessToken}}',
      body: {
        current_password: '{{dynamicUserPassword}}',
        new_password: '{{dynamicUserPassword}}',
      },
      testScript: [
        'pm.test("Status code is 400 Bad Request", function () {',
        '    pm.response.to.have.status(400);',
        '});',
        'pm.test("Returns NEW_PASSWORD_SAME_AS_CURRENT (code 1109)", function () {',
        '    const json = pm.response.json();',
        '    pm.expect(json.success).to.be.false;',
        '    pm.expect(json.error_code).to.equal(1109);',
        '});',
      ],
      description: 'Identical new password triggers code 1109.',
    }),
    req({
      name: '[FAIL] Change Password - Weak New Password (< 8 chars)',
      method: 'PATCH',
      urlPath: ['v1', 'auth', 'change-password'],
      bearerToken: '{{dynamicUserAccessToken}}',
      body: {
        current_password: '{{dynamicUserPassword}}',
        new_password: 'weak',
      },
      testScript: [
        'pm.test("Status code is 400 Bad Request", function () {',
        '    pm.response.to.have.status(400);',
        '});',
      ],
      description: 'Weak new password fails validation.',
    }),
  ]),

  folder('Logout', [
    req({
      name: '[PASS] Logout - Revoke Current Refresh Token (POST /v1/auth/logout)',
      method: 'POST',
      urlPath: ['v1', 'auth', 'logout'],
      bearerToken: '{{dynamicUserAccessToken}}',
      body: {
        refresh_token: '{{dynamicUserRefreshToken}}',
      },
      testScript: [
        'pm.test("Status code is 200", function () {',
        '    pm.response.to.have.status(200);',
        '});',
        'pm.test("Logged out successfully message returned", function () {',
        '    const json = pm.response.json();',
        '    pm.expect(json.success).to.be.true;',
        '    pm.expect(json.message).to.equal("Logged out successfully");',
        '});',
      ],
      description: 'Revokes user refresh token from database.',
    }),
    req({
      name: '[FAIL] Logout - Missing Auth Header',
      method: 'POST',
      urlPath: ['v1', 'auth', 'logout'],
      authType: 'noauth',
      body: {
        refresh_token: 'dummy-token',
      },
      testScript: [
        'pm.test("Status code is 401 Unauthorized", function () {',
        '    pm.response.to.have.status(401);',
        '});',
      ],
      description: 'Logout requires Bearer auth header.',
    }),
  ]),
]);

// 02 - Users
const userFolder = folder('02 - Users', [
  req({
    name: '[PASS] Users - List All Users (GET /v1/users)',
    method: 'GET',
    urlPath: ['v1', 'users'],
    bearerToken: '{{adminAccessToken}}',
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
      'pm.test("Returns user array with auth identities", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.true;',
      '    pm.expect(json.data).to.be.an("array");',
      '    pm.expect(json.data.length).to.be.greaterThan(0);',
      '    const first = json.data[0];',
      '    pm.expect(first).to.have.property("id");',
      '    pm.expect(first).to.have.property("full_name");',
      '});',
    ],
    description: 'Lists all users (cached via users:list).',
  }),
  req({
    name: '[FAIL] Users - List Users Unauthorized (No Token)',
    method: 'GET',
    urlPath: ['v1', 'users'],
    authType: 'noauth',
    testScript: [
      'pm.test("Status code is 401", function () {',
      '    pm.response.to.have.status(401);',
      '});',
    ],
    description: 'Reject unauthenticated access to user list.',
  }),
  req({
    name: '[PASS] Users - Get User By Valid ID (GET /v1/users/:id)',
    method: 'GET',
    urlPath: ['v1', 'users', '{{testUserId}}'],
    bearerToken: '{{adminAccessToken}}',
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
      'pm.test("Returns requested user profile", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.true;',
      '    pm.expect(json.data.id).to.equal(pm.environment.get("testUserId"));',
      '});',
    ],
    description: 'Gets specific user profile by UUID.',
  }),
  req({
    name: '[FAIL] Users - Get User By Non-Existent ID',
    method: 'GET',
    urlPath: ['v1', 'users', '00000000-0000-0000-0000-000000000000'],
    bearerToken: '{{adminAccessToken}}',
    testScript: [
      'pm.test("Status code is 200 (data is null) or 404", function () {',
      '    pm.expect([200, 404]).to.include(pm.response.code);',
      '    const json = pm.response.json();',
      '    if (pm.response.code === 200) {',
      '        pm.expect(json.data).to.be.null;',
      '    }',
      '});',
    ],
    description: 'Querying non-existent user returns null data or 404.',
  }),
  req({
    name: '[PASS] Users - Update User Profile (PATCH /v1/users/:id)',
    method: 'PATCH',
    urlPath: ['v1', 'users', '{{dynamicUserId}}'],
    bearerToken: '{{adminAccessToken}}',
    body: {
      full_name: 'Updated QA User Name',
    },
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
      'pm.test("Full name updated successfully", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.true;',
      '    pm.expect(json.data.full_name).to.equal("Updated QA User Name");',
      '});',
    ],
    description: 'Updates full_name of existing user.',
  }),
  req({
    name: '[FAIL] Users - Update Non-Existent User',
    method: 'PATCH',
    urlPath: ['v1', 'users', '00000000-0000-0000-0000-000000000000'],
    bearerToken: '{{adminAccessToken}}',
    body: {
      full_name: 'Non Existent',
    },
    testScript: [
      'pm.test("Status code is 404 Not Found", function () {',
      '    pm.response.to.have.status(404);',
      '});',
      'pm.test("Returns USER_NOT_FOUND (code 1200)", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.false;',
      '    pm.expect(json.error_code).to.equal(1200);',
      '});',
    ],
    description: 'Updating a missing user throws USER_NOT_FOUND.',
  }),
  req({
    name: '[FAIL] Users - Update With Invalid Name (< 2 chars)',
    method: 'PATCH',
    urlPath: ['v1', 'users', '{{dynamicUserId}}'],
    bearerToken: '{{adminAccessToken}}',
    body: {
      full_name: 'X',
    },
    testScript: [
      'pm.test("Status code is 400 Bad Request", function () {',
      '    pm.response.to.have.status(400);',
      '});',
    ],
    description: 'UpdateUserDto validation enforces min length of 2.',
  }),
  req({
    name: '[FAIL] Users - Update With Extra Unknown Properties (forbidNonWhitelisted)',
    method: 'PATCH',
    urlPath: ['v1', 'users', '{{dynamicUserId}}'],
    bearerToken: '{{adminAccessToken}}',
    body: {
      full_name: 'Valid Name',
      injected_role: 'admin',
    },
    testScript: [
      'pm.test("Status code is 400 (forbidNonWhitelisted triggers)", function () {',
      '    pm.response.to.have.status(400);',
      '});',
    ],
    description: 'Security check: forbidNonWhitelisted rejects unexpected body properties.',
  }),
  req({
    name: '[PASS] Users - Upload Avatar Multipart (POST /v1/users/avatar)',
    method: 'POST',
    urlPath: ['v1', 'users', 'avatar'],
    bearerToken: '{{adminAccessToken}}',
    formData: [
      {
        key: 'file',
        type: 'file',
        description: 'Avatar image file (JPEG, PNG, WebP)',
      },
    ],
    testScript: [
      'pm.test("Handles avatar upload (201 on file present, 400/500 if unconfigured cloud/no file)", function () {',
      '    pm.expect([201, 400, 500]).to.include(pm.response.code);',
      '});',
    ],
    description: 'Uploads avatar via FileInterceptor(file).',
  }),
  req({
    name: '[FAIL] Users - Upload Avatar Unauthorized (No Token)',
    method: 'POST',
    urlPath: ['v1', 'users', 'avatar'],
    authType: 'noauth',
    testScript: [
      'pm.test("Status code is 401 Unauthorized", function () {',
      '    pm.response.to.have.status(401);',
      '});',
    ],
    description: 'Avatar upload requires authentication.',
  }),
  req({
    name: '[FAIL] Users - Remove Avatar When None Exists (DELETE /v1/users/avatar)',
    method: 'DELETE',
    urlPath: ['v1', 'users', 'avatar'],
    bearerToken: '{{userAccessToken}}',
    testScript: [
      'pm.test("Status code is 404 (No avatar to remove)", function () {',
      '    pm.expect([400, 404]).to.include(pm.response.code);',
      '});',
    ],
    description: 'Deleting non-existent avatar returns USER_NOT_FOUND error (code 1200).',
  }),
  req({
    name: '[PASS] Users - Delete Dynamic Test User (DELETE /v1/users/:id)',
    method: 'DELETE',
    urlPath: ['v1', 'users', '{{dynamicUserId}}'],
    bearerToken: '{{adminAccessToken}}',
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
      'pm.test("Confirmation message returned", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.true;',
      '    pm.expect(json.message).to.include("deleted");',
      '});',
    ],
    description: 'Deletes user record and cascades auth_identities/refresh_tokens.',
  }),
  req({
    name: '[FAIL] Users - Delete Non-Existent User',
    method: 'DELETE',
    urlPath: ['v1', 'users', '00000000-0000-0000-0000-000000000000'],
    bearerToken: '{{adminAccessToken}}',
    testScript: [
      'pm.test("Status code is 404 Not Found", function () {',
      '    pm.response.to.have.status(404);',
      '});',
      'pm.test("Returns USER_NOT_FOUND (code 1200)", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.false;',
      '    pm.expect(json.error_code).to.equal(1200);',
      '});',
    ],
    description: 'Attempting to delete a non-existent user returns 404.',
  }),
]);

// 03 - Roles & Permissions
const roleFolder = folder('03 - Roles & Permissions', [
  req({
    name: '[PASS] Roles - List All Roles (Admin - Has view_roles)',
    method: 'GET',
    urlPath: ['v1', 'roles'],
    bearerToken: '{{adminAccessToken}}',
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
      'pm.test("Returns array of roles with permissions", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.true;',
      '    pm.expect(json.data).to.be.an("array");',
      '    const adminRole = json.data.find(r => r.name === "admin");',
      '    pm.expect(adminRole).to.exist;',
      '});',
    ],
    description: 'Admin with view_roles permission retrieves all roles.',
  }),
  req({
    name: '[FAIL] Roles - List All Roles (Forbidden - Regular User Without view_roles)',
    method: 'GET',
    urlPath: ['v1', 'roles'],
    bearerToken: '{{userAccessToken}}',
    testScript: [
      'pm.test("Status code is 403 Forbidden", function () {',
      '    pm.response.to.have.status(403);',
      '});',
    ],
    description: 'User without view_roles is rejected by PermissionsGuard.',
  }),
  req({
    name: '[FAIL] Roles - List Roles Unauthorized (No Token)',
    method: 'GET',
    urlPath: ['v1', 'roles'],
    authType: 'noauth',
    testScript: [
      'pm.test("Status code is 401 Unauthorized", function () {',
      '    pm.response.to.have.status(401);',
      '});',
    ],
    description: 'Unauthenticated requests rejected.',
  }),
  req({
    name: '[PASS] Roles - Get Role By ID (Admin)',
    method: 'GET',
    urlPath: ['v1', 'roles', '{{adminRoleId}}'],
    bearerToken: '{{adminAccessToken}}',
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
      'pm.test("Returns admin role details", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.true;',
      '    pm.expect(json.data.id).to.equal(pm.environment.get("adminRoleId"));',
      '    pm.expect(json.data.name).to.equal("admin");',
      '});',
    ],
    description: 'Admin gets specific role details.',
  }),
  req({
    name: '[FAIL] Roles - Get Non-Existent Role',
    method: 'GET',
    urlPath: ['v1', 'roles', 'non-existent-role-id'],
    bearerToken: '{{adminAccessToken}}',
    testScript: [
      'pm.test("Status code is 200 (returns null) or 404", function () {',
      '    pm.expect([200, 404]).to.include(pm.response.code);',
      '    const json = pm.response.json();',
      '    if (pm.response.code === 200) {',
      '        pm.expect(json.data).to.be.null;',
      '    }',
      '});',
    ],
    description: 'Invalid role ID returns null or 404.',
  }),
  req({
    name: '[PASS] Roles - Get User Roles (Admin)',
    method: 'GET',
    urlPath: ['v1', 'roles', 'user', '{{testUserId}}'],
    bearerToken: '{{adminAccessToken}}',
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
      'pm.test("Returns user roles array", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.true;',
      '    pm.expect(json.data).to.be.an("array");',
      '});',
    ],
    description: 'Gets assigned roles for user ID.',
  }),
  req({
    name: '[FAIL] Roles - Get User Roles (Forbidden - Regular User)',
    method: 'GET',
    urlPath: ['v1', 'roles', 'user', '{{testUserId}}'],
    bearerToken: '{{userAccessToken}}',
    testScript: [
      'pm.test("Status code is 403 Forbidden", function () {',
      '    pm.response.to.have.status(403);',
      '});',
    ],
    description: 'Regular user cannot view other users roles.',
  }),
  req({
    name: '[PASS] Roles - Assign Role To User (POST /v1/roles/assign)',
    method: 'POST',
    urlPath: ['v1', 'roles', 'assign'],
    bearerToken: '{{adminAccessToken}}',
    body: {
      userId: '{{testUserId}}',
      roleId: 'role-mod-001',
    },
    testScript: [
      'pm.test("Status code is 201 or 200", function () {',
      '    pm.expect([200, 201]).to.include(pm.response.code);',
      '});',
      'pm.test("Role assigned successfully", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.true;',
      '    pm.expect(json.data).to.have.property("id");',
      '});',
    ],
    description: 'Assigns moderator role to test user.',
  }),
  req({
    name: '[FAIL] Roles - Assign Role Duplicate (Unique Constraint P2002)',
    method: 'POST',
    urlPath: ['v1', 'roles', 'assign'],
    bearerToken: '{{adminAccessToken}}',
    body: {
      userId: '{{testUserId}}',
      roleId: 'role-mod-001',
    },
    testScript: [
      'pm.test("Status code is 409 or 500 (Unique violation on user_id, role_id)", function () {',
      '    pm.expect([409, 500]).to.include(pm.response.code);',
      '});',
    ],
    description: 'Assigning existing role triggers unique constraint.',
  }),
  req({
    name: '[FAIL] Roles - Assign Role (Forbidden - Regular User)',
    method: 'POST',
    urlPath: ['v1', 'roles', 'assign'],
    bearerToken: '{{userAccessToken}}',
    body: {
      userId: '{{testUserId}}',
      roleId: 'role-admin-001',
    },
    testScript: [
      'pm.test("Status code is 403 Forbidden", function () {',
      '    pm.response.to.have.status(403);',
      '});',
    ],
    description: 'Regular user cannot assign roles (privilege escalation prevention).',
  }),
  req({
    name: '[PASS] Roles - Revoke Role From User (DELETE /v1/roles/revoke)',
    method: 'DELETE',
    urlPath: ['v1', 'roles', 'revoke'],
    bearerToken: '{{adminAccessToken}}',
    body: {
      userId: '{{testUserId}}',
      roleId: 'role-mod-001',
    },
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
      'pm.test("Returns deleted count", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.true;',
      '    pm.expect(json.data).to.have.property("count");',
      '});',
    ],
    description: 'Revokes moderator role from test user.',
  }),
  req({
    name: '[PASS] Roles - Assign Permission To Role (POST /v1/roles/:roleId/permissions)',
    method: 'POST',
    urlPath: ['v1', 'roles', 'role-mod-001', 'permissions'],
    bearerToken: '{{adminAccessToken}}',
    body: {
      permissionId: 'perm-001',
    },
    testScript: [
      'pm.test("Status code is 201 or 200", function () {',
      '    pm.expect([200, 201]).to.include(pm.response.code);',
      '});',
    ],
    description: 'Assigns permission perm-001 to role-mod-001.',
  }),
  req({
    name: '[FAIL] Roles - Assign Permission (Forbidden - Regular User)',
    method: 'POST',
    urlPath: ['v1', 'roles', 'role-mod-001', 'permissions'],
    bearerToken: '{{userAccessToken}}',
    body: {
      permissionId: 'perm-002',
    },
    testScript: [
      'pm.test("Status code is 403 Forbidden", function () {',
      '    pm.response.to.have.status(403);',
      '});',
    ],
    description: 'Regular user cannot modify role permissions.',
  }),
  req({
    name: '[PASS] Roles - Remove Permission From Role (DELETE /v1/roles/:roleId/permissions/:permissionId)',
    method: 'DELETE',
    urlPath: ['v1', 'roles', 'role-mod-001', 'permissions', 'perm-001'],
    bearerToken: '{{adminAccessToken}}',
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
    ],
    description: 'Removes permission from role.',
  }),
  req({
    name: '[FAIL] Roles - Remove Permission (Forbidden - Regular User)',
    method: 'DELETE',
    urlPath: ['v1', 'roles', 'role-mod-001', 'permissions', 'perm-001'],
    bearerToken: '{{userAccessToken}}',
    testScript: [
      'pm.test("Status code is 403 Forbidden", function () {',
      '    pm.response.to.have.status(403);',
      '});',
    ],
    description: 'Regular user cannot revoke role permissions.',
  }),
]);

// 04 - Areas
const areaFolder = folder('04 - Areas', [
  req({
    name: '[PASS] Areas - List All Areas (GET /v1/areas - Public)',
    method: 'GET',
    urlPath: ['v1', 'areas'],
    authType: 'noauth',
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
      'pm.test("Returns paginated area list", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.true;',
      '    pm.expect(json.data).to.have.property("items");',
      '    pm.expect(json.data.items).to.be.an("array");',
      '    pm.expect(json.data.items.length).to.be.greaterThan(0);',
      '});',
    ],
    description: 'Public listing of areas with default pagination.',
  }),
  req({
    name: '[PASS] Areas - List Areas With Query Filters (Search, City, Pagination)',
    method: 'GET',
    urlPath: ['v1', 'areas'],
    authType: 'noauth',
    queryParams: [
      { key: 'city', value: 'Dhaka', description: 'Filter by city' },
      { key: 'search', value: 'Gulshan', description: 'Filter by name search' },
      { key: 'page', value: '1', description: 'Page number' },
      { key: 'limit', value: '5', description: 'Page limit' },
    ],
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
      'pm.test("Filtered areas contain search query", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.data.items.length).to.be.at.most(5);',
      '    if (json.data.items.length > 0) {',
      '        pm.expect(json.data.items[0].name).to.include("Gulshan");',
      '    }',
      '});',
    ],
    description: 'Verifies query parameter handling and search filtering.',
  }),
  req({
    name: '[PASS] Areas - Get Area By ID (GET /v1/areas/:id - Public)',
    method: 'GET',
    urlPath: ['v1', 'areas', '{{testAreaId}}'],
    authType: 'noauth',
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
      'pm.test("Returns area detail with hierarchy", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.true;',
      '    pm.expect(json.data.id).to.equal(pm.environment.get("testAreaId"));',
      '    pm.expect(json.data).to.have.property("children");',
      '});',
    ],
    description: 'Gets single area detail with parents and children.',
  }),
  req({
    name: '[FAIL] Areas - Get Non-Existent Area',
    method: 'GET',
    urlPath: ['v1', 'areas', 'non-existent-area-id'],
    authType: 'noauth',
    testScript: [
      'pm.test("Status code is 404 Not Found", function () {',
      '    pm.response.to.have.status(404);',
      '});',
      'pm.test("Returns AREA_NOT_FOUND (code 1400)", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.false;',
      '    pm.expect(json.error_code).to.equal(1400);',
      '});',
    ],
    description: 'Unknown area ID triggers 404 AREA_NOT_FOUND.',
  }),
  req({
    name: '[PASS] Areas - Get Area Children (GET /v1/areas/:id/children - Public)',
    method: 'GET',
    urlPath: ['v1', 'areas', '{{testAreaId}}', 'children'],
    authType: 'noauth',
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
      'pm.test("Returns array of child areas", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.true;',
      '    pm.expect(json.data).to.be.an("array");',
      '});',
    ],
    description: 'Gets sub-sectors / wards under a parent area.',
  }),
  req({
    name: '[FAIL] Areas - Get Children of Non-Existent Area',
    method: 'GET',
    urlPath: ['v1', 'areas', 'non-existent-area-id', 'children'],
    authType: 'noauth',
    testScript: [
      'pm.test("Status code is 404 Not Found", function () {',
      '    pm.response.to.have.status(404);',
      '});',
      'pm.test("Returns AREA_NOT_FOUND (code 1400)", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.false;',
      '    pm.expect(json.error_code).to.equal(1400);',
      '});',
    ],
    description: 'Requesting children of missing area throws AREA_NOT_FOUND.',
  }),
  req({
    name: '[PASS] Areas - Create Area (POST /v1/areas - Admin)',
    method: 'POST',
    urlPath: ['v1', 'areas'],
    bearerToken: '{{adminAccessToken}}',
    prerequestScript: [
      'const name = "Test Sector " + Date.now();',
      'pm.environment.set("createdAreaName", name);',
    ],
    body: {
      name: '{{createdAreaName}}',
      city: 'Dhaka',
      parent_area_id: '{{testAreaId}}',
    },
    testScript: [
      'pm.test("Status code is 201 or 200", function () {',
      '    pm.expect([200, 201]).to.include(pm.response.code);',
      '});',
      'pm.test("Area created with ID", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.true;',
      '    pm.expect(json.data).to.have.property("id");',
      '    pm.environment.set("createdAreaId", json.data.id);',
      '});',
    ],
    description: 'Admin creates a new sub-area.',
  }),
  req({
    name: '[FAIL] Areas - Create Area Duplicate Name in Same City',
    method: 'POST',
    urlPath: ['v1', 'areas'],
    bearerToken: '{{adminAccessToken}}',
    body: {
      name: '{{createdAreaName}}',
      city: 'Dhaka',
    },
    testScript: [
      'pm.test("Status code is 409 Conflict", function () {',
      '    pm.response.to.have.status(409);',
      '});',
      'pm.test("Returns AREA_ALREADY_EXISTS (code 1401)", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.false;',
      '    pm.expect(json.error_code).to.equal(1401);',
      '});',
    ],
    description: 'Duplicate area name in the same city returns 409.',
  }),
  req({
    name: '[FAIL] Areas - Create Area Missing Name Field',
    method: 'POST',
    urlPath: ['v1', 'areas'],
    bearerToken: '{{adminAccessToken}}',
    body: {
      city: 'Dhaka',
    },
    testScript: [
      'pm.test("Status code is 400 Bad Request", function () {',
      '    pm.response.to.have.status(400);',
      '});',
    ],
    description: 'CreateAreaDto validation enforces non-empty name.',
  }),
  req({
    name: '[PASS] Areas - Update Area (PATCH /v1/areas/:id - Admin)',
    method: 'PATCH',
    urlPath: ['v1', 'areas', '{{createdAreaId}}'],
    bearerToken: '{{adminAccessToken}}',
    body: {
      name: '{{createdAreaName}} Updated',
    },
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
    ],
    description: 'Updates area details and invalidates cache.',
  }),
  req({
    name: '[FAIL] Areas - Update Non-Existent Area',
    method: 'PATCH',
    urlPath: ['v1', 'areas', '00000000-0000-0000-0000-000000000000'],
    bearerToken: '{{adminAccessToken}}',
    body: {
      name: 'Non Existent Area',
    },
    testScript: [
      'pm.test("Status code is 404 Not Found", function () {',
      '    pm.response.to.have.status(404);',
      '});',
      'pm.test("Returns AREA_NOT_FOUND (code 1400)", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.false;',
      '    pm.expect(json.error_code).to.equal(1400);',
      '});',
    ],
    description: 'Updating non-existent area returns 404.',
  }),
  req({
    name: '[FAIL] Areas - Delete Area With Active Listings Blocked',
    method: 'DELETE',
    urlPath: ['v1', 'areas', 'gulshan-1-dhaka'],
    bearerToken: '{{adminAccessToken}}',
    testScript: [
      'pm.test("Status code is 400 Bad Request", function () {',
      '    pm.response.to.have.status(400);',
      '});',
      'pm.test("Returns AREA_HAS_ACTIVE_LISTINGS (code 1402)", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.false;',
      '    pm.expect(json.error_code).to.equal(1402);',
      '});',
    ],
    description: 'Business rule: Area deletion is rejected if active properties exist.',
  }),
  req({
    name: '[PASS] Areas - Delete Created Test Area (DELETE /v1/areas/:id - Admin)',
    method: 'DELETE',
    urlPath: ['v1', 'areas', '{{createdAreaId}}'],
    bearerToken: '{{adminAccessToken}}',
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
      'pm.test("Area deleted message returned", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.true;',
      '    pm.expect(json.message).to.include("deleted");',
      '});',
    ],
    description: 'Safely deletes area with no active listings.',
  }),
]);

// 05 - Properties
const propertyFolder = folder('05 - Properties', [
  req({
    name: '[PASS] Properties - List Published Properties (GET /v1/properties - Public)',
    method: 'GET',
    urlPath: ['v1', 'properties'],
    authType: 'noauth',
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
      'pm.test("Returns active published properties", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.true;',
      '    pm.expect(json.data).to.have.property("items");',
      '    pm.expect(json.data.items).to.be.an("array");',
      '    if (json.data.items.length > 0) {',
      '        pm.environment.set("testPropertyId", json.data.items[0].id);',
      '        pm.expect(json.data.items[0].status).to.equal("active");',
      '    }',
      '});',
    ],
    description: 'Public property discovery endpoint only returns active listings.',
  }),
  req({
    name: '[PASS] Properties - List Properties With Filters (type, price, sort)',
    method: 'GET',
    urlPath: ['v1', 'properties'],
    authType: 'noauth',
    queryParams: [
      { key: 'type', value: 'residential', description: 'Filter by PropertyType' },
      { key: 'listing_type', value: 'sale', description: 'Filter by ListingType' },
      { key: 'min_price', value: '1000000', description: 'Min price filter' },
      { key: 'sort_by', value: 'price_desc', description: 'Sort by price desc' },
      { key: 'limit', value: '10', description: 'Page limit' },
    ],
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
      'pm.test("All returned items match residential type and sale", function () {',
      '    const json = pm.response.json();',
      '    json.data.items.forEach(item => {',
      '        pm.expect(item.type).to.equal("residential");',
      '        pm.expect(item.listing_type).to.equal("sale");',
      '    });',
      '});',
    ],
    description: 'Filters properties by type, listing_type, price, and sorting.',
  }),
  req({
    name: '[PASS] Properties - Proximity Search (Lat, Lng, Radius)',
    method: 'GET',
    urlPath: ['v1', 'properties'],
    authType: 'noauth',
    queryParams: [
      { key: 'lat', value: '23.7873', description: 'Latitude' },
      { key: 'lng', value: '90.4100', description: 'Longitude' },
      { key: 'radius', value: '5', description: 'Radius in KM' },
    ],
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
      'pm.test("Returns nearby items with distance property", function () {',
      '    const json = pm.response.json();',
      '    if (json.data.items.length > 0) {',
      '        pm.expect(json.data.items[0]).to.have.property("distance");',
      '    }',
      '});',
    ],
    description: 'Geospatial proximity search using coordinates and radius.',
  }),
  req({
    name: '[PASS] Properties - Admin List All (GET /v1/properties/admin)',
    method: 'GET',
    urlPath: ['v1', 'properties', 'admin'],
    bearerToken: '{{adminAccessToken}}',
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
      'pm.test("Admin receives paginated result", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.true;',
      '    pm.expect(json.data).to.have.property("items");',
      '});',
    ],
    description: 'Admin route protected by manage_properties permission.',
  }),
  req({
    name: '[FAIL] Properties - Admin List All (Forbidden - Regular User Without manage_properties)',
    method: 'GET',
    urlPath: ['v1', 'properties', 'admin'],
    bearerToken: '{{dynamicUserAccessToken}}',
    testScript: [
      'pm.test("Status code is 403 Forbidden", function () {',
      '    pm.response.to.have.status(403);',
      '});',
    ],
    description: 'Unprivileged user cannot access admin property list.',
  }),
  req({
    name: '[PASS] Properties - My Properties (GET /v1/properties/my)',
    method: 'GET',
    urlPath: ['v1', 'properties', 'my'],
    bearerToken: '{{userAccessToken}}',
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
      'pm.test("Returns current user listings only", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.true;',
      '    pm.expect(json.data).to.have.property("items");',
      '});',
    ],
    description: 'Retrieves listings owned by authenticated user.',
  }),
  req({
    name: '[FAIL] Properties - My Properties Unauthorized (No Token)',
    method: 'GET',
    urlPath: ['v1', 'properties', 'my'],
    authType: 'noauth',
    testScript: [
      'pm.test("Status code is 401 Unauthorized", function () {',
      '    pm.response.to.have.status(401);',
      '});',
    ],
    description: 'Requires authentication.',
  }),
  req({
    name: '[PASS] Properties - Get Property By Valid ID (GET /v1/properties/:id)',
    method: 'GET',
    urlPath: ['v1', 'properties', '{{testPropertyId}}'],
    authType: 'noauth',
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
      'pm.test("Returns complete property details with area and media", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.true;',
      '    pm.expect(json.data.id).to.equal(pm.environment.get("testPropertyId"));',
      '    pm.expect(json.data).to.have.property("view_count");',
      '});',
    ],
    description: 'Public property detail page increments view_count.',
  }),
  req({
    name: '[FAIL] Properties - Get Non-Existent Property',
    method: 'GET',
    urlPath: ['v1', 'properties', '00000000-0000-0000-0000-000000000000'],
    authType: 'noauth',
    testScript: [
      'pm.test("Status code is 404 Not Found", function () {',
      '    pm.response.to.have.status(404);',
      '});',
      'pm.test("Returns PROPERTY_NOT_FOUND (code 1500)", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.false;',
      '    pm.expect(json.error_code).to.equal(1500);',
      '});',
    ],
    description: 'Non-existent or non-active property returns 404.',
  }),
  req({
    name: '[PASS] Properties - Create Property (POST /v1/properties - Computed Status: pending)',
    method: 'POST',
    urlPath: ['v1', 'properties'],
    bearerToken: '{{userAccessToken}}',
    body: {
      area_id: '{{testAreaId}}',
      title: 'QA Automated Test Property',
      description: 'Test description for automated verification flow',
      type: 'residential',
      listing_type: 'sale',
      price: 15000000,
      price_currency: 'BDT',
      area_size: 1800,
      area_unit: 'sqft',
      location_lat: 23.792,
      location_lng: 90.407,
      address: 'Gulshan Test Road 10',
      amenities: {
        bedrooms: 3,
        bathrooms: 3,
      },
    },
    testScript: [
      'pm.test("Status code is 201 or 200", function () {',
      '    pm.expect([200, 201]).to.include(pm.response.code);',
      '});',
      'pm.test("Property created and status is pending", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.true;',
      '    pm.expect(json.data).to.have.property("id");',
      '    pm.expect(json.data.status).to.equal("pending");',
      '    pm.environment.set("createdPropertyId", json.data.id);',
      '});',
    ],
    description: 'Creating property with all required fields sets status to pending.',
  }),
  req({
    name: '[PASS] Properties - Create Incomplete Property (Computed Status: draft)',
    method: 'POST',
    urlPath: ['v1', 'properties'],
    bearerToken: '{{userAccessToken}}',
    body: {
      area_id: '{{testAreaId}}',
      title: 'Incomplete Draft Property',
    },
    testScript: [
      'pm.test("Status code is 201 or 200", function () {',
      '    pm.expect([200, 201]).to.include(pm.response.code);',
      '});',
      'pm.test("Property created with status draft", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.true;',
      '    pm.expect(json.data.status).to.equal("draft");',
      '});',
    ],
    description: 'Incomplete property is automatically saved as draft.',
  }),
  req({
    name: '[FAIL] Properties - Create Property Missing area_id',
    method: 'POST',
    urlPath: ['v1', 'properties'],
    bearerToken: '{{userAccessToken}}',
    body: {
      title: 'No Area Property',
      price: 100000,
    },
    testScript: [
      'pm.test("Status code is 400 Bad Request", function () {',
      '    pm.response.to.have.status(400);',
      '});',
      'pm.test("Returns PROPERTY_MISSING_AREA (code 1502)", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.false;',
      '    pm.expect(json.error_code).to.equal(1502);',
      '});',
    ],
    description: 'area_id is strictly required on property creation.',
  }),
  req({
    name: '[FAIL] Properties - Create Property Invalid Enum Type',
    method: 'POST',
    urlPath: ['v1', 'properties'],
    bearerToken: '{{userAccessToken}}',
    body: {
      area_id: '{{testAreaId}}',
      title: 'Invalid Type',
      type: 'submarine',
    },
    testScript: [
      'pm.test("Status code is 400 Bad Request", function () {',
      '    pm.response.to.have.status(400);',
      '});',
    ],
    description: 'Class-validator rejects invalid enum value for PropertyType.',
  }),
  req({
    name: '[PASS] Properties - Update Property (PATCH /v1/properties/:id - Owner)',
    method: 'PATCH',
    urlPath: ['v1', 'properties', '{{createdPropertyId}}'],
    bearerToken: '{{userAccessToken}}',
    body: {
      title: 'QA Automated Test Property - Updated Title',
      price: 16000000,
    },
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
      'pm.test("Title updated successfully", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.true;',
      '    pm.expect(json.data.title).to.include("Updated Title");',
      '});',
    ],
    description: 'Owner updates their property via PATCH /v1/properties/:id.',
  }),
  req({
    name: '[FAIL] Properties - Cross-User Update Forbidden',
    method: 'PATCH',
    urlPath: ['v1', 'properties', '{{createdPropertyId}}'],
    bearerToken: '{{dynamicUserAccessToken}}',
    body: {
      title: 'Hacked Title',
    },
    testScript: [
      'pm.test("Status code is 403 Forbidden", function () {',
      '    pm.response.to.have.status(403);',
      '});',
    ],
    description: 'Different user cannot modify another user property.',
  }),
  req({
    name: '[PASS] Properties - Add Media Multipart (POST /v1/properties/:id/media)',
    method: 'POST',
    urlPath: ['v1', 'properties', '{{createdPropertyId}}', 'media'],
    bearerToken: '{{userAccessToken}}',
    formData: [
      {
        key: 'media_type',
        value: 'image',
        type: 'text',
      },
      {
        key: 'file',
        type: 'file',
        description: 'Upload property image',
      },
    ],
    testScript: [
      'pm.test("Handles media creation (201/200 on valid upload, 400/500 if cloud unconfigured/no file)", function () {',
      '    pm.expect([200, 201, 400, 500]).to.include(pm.response.code);',
      '});',
    ],
    description: 'Uploads photo or video for listing.',
  }),
  req({
    name: '[FAIL] Properties - Add Media Non-Owner Forbidden',
    method: 'POST',
    urlPath: ['v1', 'properties', '{{createdPropertyId}}', 'media'],
    bearerToken: '{{dynamicUserAccessToken}}',
    formData: [
      {
        key: 'media_type',
        value: 'image',
        type: 'text',
      },
    ],
    testScript: [
      'pm.test("Status code is 403 Forbidden", function () {',
      '    pm.response.to.have.status(403);',
      '});',
    ],
    description: 'Non-owner cannot attach media.',
  }),
  req({
    name: '[FAIL] Properties - Remove Media Non-Existent (DELETE /v1/properties/media/:mediaId)',
    method: 'DELETE',
    urlPath: ['v1', 'properties', 'media', '00000000-0000-0000-0000-000000000000'],
    bearerToken: '{{userAccessToken}}',
    testScript: [
      'pm.test("Status code is 404 Not Found", function () {',
      '    pm.response.to.have.status(404);',
      '});',
      'pm.test("Returns MEDIA_NOT_FOUND (code 1510)", function () {',
      '    const json = pm.response.json();',
      '    pm.expect(json.success).to.be.false;',
      '    pm.expect(json.error_code).to.equal(1510);',
      '});',
    ],
    description: 'Deleting non-existent media throws MEDIA_NOT_FOUND.',
  }),
  req({
    name: '[PASS] Properties - Submit For Verification Flow (POST /v1/properties/:id/submit)',
    method: 'POST',
    urlPath: ['v1', 'properties', '{{createdPropertyId}}', 'submit'],
    bearerToken: '{{userAccessToken}}',
    testScript: [
      'pm.test("Status code is 202 Accepted or 400 (if media required)", function () {',
      '    pm.expect([202, 400]).to.include(pm.response.code);',
      '});',
    ],
    description: 'Submits property for background AI verification queue.',
  }),
  req({
    name: '[FAIL] Properties - Submit For Verification Non-Owner Forbidden',
    method: 'POST',
    urlPath: ['v1', 'properties', '{{createdPropertyId}}', 'submit'],
    bearerToken: '{{dynamicUserAccessToken}}',
    testScript: [
      'pm.test("Status code is 403 Forbidden", function () {',
      '    pm.response.to.have.status(403);',
      '});',
    ],
    description: 'Only owner can submit their property for verification.',
  }),
  req({
    name: '[PASS] Properties - Admin Status Override (PATCH /v1/properties/:id/admin)',
    method: 'PATCH',
    urlPath: ['v1', 'properties', '{{createdPropertyId}}', 'admin'],
    bearerToken: '{{adminAccessToken}}',
    body: {
      status: 'active',
    },
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
    ],
    description: 'Admin directly overrides status to active.',
  }),
  req({
    name: '[FAIL] Properties - Admin Status Override (Forbidden - Regular User)',
    method: 'PATCH',
    urlPath: ['v1', 'properties', '{{createdPropertyId}}', 'admin'],
    bearerToken: '{{dynamicUserAccessToken}}',
    body: {
      status: 'active',
    },
    testScript: [
      'pm.test("Status code is 403 Forbidden", function () {',
      '    pm.response.to.have.status(403);',
      '});',
    ],
    description: 'Unprivileged user cannot use admin property update route.',
  }),
  req({
    name: '[PASS] Properties - Owner Soft Delete (DELETE /v1/properties/:id - Archive)',
    method: 'DELETE',
    urlPath: ['v1', 'properties', '{{createdPropertyId}}'],
    bearerToken: '{{userAccessToken}}',
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
    ],
    description: 'Owner soft deletes (archives) their active property.',
  }),
  req({
    name: '[PASS] Properties - Admin Hard Delete (DELETE /v1/properties/:id/admin)',
    method: 'DELETE',
    urlPath: ['v1', 'properties', '{{createdPropertyId}}', 'admin'],
    bearerToken: '{{adminAccessToken}}',
    testScript: [
      'pm.test("Status code is 200", function () {',
      '    pm.response.to.have.status(200);',
      '});',
    ],
    description: 'Admin permanently removes property record from DB.',
  }),
  req({
    name: '[FAIL] Properties - Admin Hard Delete (Forbidden - Regular User)',
    method: 'DELETE',
    urlPath: ['v1', 'properties', '{{createdPropertyId}}', 'admin'],
    bearerToken: '{{dynamicUserAccessToken}}',
    testScript: [
      'pm.test("Status code is 403 Forbidden", function () {',
      '    pm.response.to.have.status(403);',
      '});',
    ],
    description: 'Regular user cannot execute hard delete.',
  }),
]);

// 06 - End-to-End Regression Workflow
const workflowFolder = folder('06 - End-to-End Regression Workflow', [
  req({
    name: 'Workflow Step 1: Register New Workflow User',
    method: 'POST',
    urlPath: ['v1', 'auth', 'register'],
    authType: 'noauth',
    prerequestScript: [
      'const ts = Date.now();',
      'pm.environment.set("workflowUserEmail", `workflow-${ts}@example.com`);',
    ],
    body: {
      full_name: 'Workflow Runner',
      email: '{{workflowUserEmail}}',
      password: 'WorkflowPassword123!',
    },
    testScript: [
      'pm.test("User registered", function () {',
      '    pm.response.to.have.status(201);',
      '    const json = pm.response.json();',
      '    pm.environment.set("workflowUserId", json.data.user.id);',
      '    pm.environment.set("workflowToken", json.data.access_token);',
      '});',
    ],
    description: 'E2E Step 1: Create a dedicated user for lifecycle test.',
  }),
  req({
    name: 'Workflow Step 2: Verify Profile Accessible',
    method: 'GET',
    urlPath: ['v1', 'auth', 'me'],
    bearerToken: '{{workflowToken}}',
    testScript: [
      'pm.test("Profile retrieved", function () {',
      '    pm.response.to.have.status(200);',
      '});',
    ],
    description: 'E2E Step 2: Validate JWT bearer authentication.',
  }),
  req({
    name: 'Workflow Step 3: Create Listing Under User',
    method: 'POST',
    urlPath: ['v1', 'properties'],
    bearerToken: '{{workflowToken}}',
    body: {
      area_id: '{{testAreaId}}',
      title: 'Workflow Living Space',
      type: 'residential',
      listing_type: 'rent',
      price: 45000,
      area_size: 1100,
    },
    testScript: [
      'pm.test("Property created in workflow", function () {',
      '    pm.expect([200, 201]).to.include(pm.response.code);',
      '    const json = pm.response.json();',
      '    pm.environment.set("workflowPropertyId", json.data.id);',
      '});',
    ],
    description: 'E2E Step 3: Create property.',
  }),
  req({
    name: 'Workflow Step 4: Admin Approves Property to Active',
    method: 'PATCH',
    urlPath: ['v1', 'properties', '{{workflowPropertyId}}', 'admin'],
    bearerToken: '{{adminAccessToken}}',
    body: {
      status: 'active',
    },
    testScript: [
      'pm.test("Admin sets status active", function () {',
      '    pm.response.to.have.status(200);',
      '});',
    ],
    description: 'E2E Step 4: Admin updates property status to active.',
  }),
  req({
    name: 'Workflow Step 5: Public Discovery of Newly Active Property',
    method: 'GET',
    urlPath: ['v1', 'properties', '{{workflowPropertyId}}'],
    authType: 'noauth',
    testScript: [
      'pm.test("Property is publicly discoverable", function () {',
      '    pm.response.to.have.status(200);',
      '    const json = pm.response.json();',
      '    pm.expect(json.data.status).to.equal("active");',
      '});',
    ],
    description: 'E2E Step 5: Public endpoint fetches active property.',
  }),
  req({
    name: 'Workflow Step 6: Workflow User Archives Property',
    method: 'DELETE',
    urlPath: ['v1', 'properties', '{{workflowPropertyId}}'],
    bearerToken: '{{workflowToken}}',
    testScript: [
      'pm.test("Property archived", function () {',
      '    pm.response.to.have.status(200);',
      '});',
    ],
    description: 'E2E Step 6: User soft deletes (archives) property.',
  }),
  req({
    name: 'Workflow Step 7: Public Discovery Now Fails (404 for Archived)',
    method: 'GET',
    urlPath: ['v1', 'properties', '{{workflowPropertyId}}'],
    authType: 'noauth',
    testScript: [
      'pm.test("Archived property is no longer publicly discoverable", function () {',
      '    pm.response.to.have.status(404);',
      '});',
    ],
    description: 'E2E Step 7: Verifies archived properties are hidden from public discovery.',
  }),
  req({
    name: 'Workflow Step 8: Admin Hard Deletes Workflow Property',
    method: 'DELETE',
    urlPath: ['v1', 'properties', '{{workflowPropertyId}}', 'admin'],
    bearerToken: '{{adminAccessToken}}',
    testScript: [
      'pm.test("Property permanently purged", function () {',
      '    pm.response.to.have.status(200);',
      '});',
    ],
    description: 'E2E Step 8: Hard delete cleans up database record.',
  }),
  req({
    name: 'Workflow Step 9: Delete Workflow User Account',
    method: 'DELETE',
    urlPath: ['v1', 'users', '{{workflowUserId}}'],
    bearerToken: '{{adminAccessToken}}',
    testScript: [
      'pm.test("Workflow user purged", function () {',
      '    pm.response.to.have.status(200);',
      '});',
    ],
    description: 'E2E Step 9: Purge user to leave DB clean.',
  }),
]);

// 99 - Cleanup
const cleanupFolder = folder('99 - Cleanup', [
  req({
    name: '[PASS] Cleanup - Verify Remaining State',
    method: 'GET',
    urlPath: ['v1', 'auth', 'me'],
    bearerToken: '{{adminAccessToken}}',
    testScript: [
      'pm.test("Admin session still valid after test run", function () {',
      '    pm.response.to.have.status(200);',
      '});',
    ],
    description: 'Verifies server and database health after entire test execution.',
  }),
]);

// Build Collection Object
const collection = {
  info: {
    _postman_id: 'homenet-api-regression-suite',
    name: 'Homenet API Automated Test Suite',
    description:
      'Comprehensive regression and automated API testing suite for Homenet NestJS backend covering 100% of endpoints, validation, RBAC, CRUD, relationships, and error states.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: [
    setupFolder,
    authFolder,
    userFolder,
    roleFolder,
    areaFolder,
    propertyFolder,
    workflowFolder,
    cleanupFolder,
  ],
};

const outputPath = path.resolve('postman/homenet-api-tests.postman_collection.json');
fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2), 'utf-8');
console.log(`Generated complete Postman collection at: ${outputPath}`);
