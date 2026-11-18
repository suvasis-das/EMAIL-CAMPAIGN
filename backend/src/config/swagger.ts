/**
 * OpenAPI 3.0 specification served at GET /api-docs via swagger-ui-express.
 * Keeping the spec as a plain TypeScript object avoids brittle JSDoc comment parsing
 * and makes every endpoint easy to read in one place.
 */
export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Email Campaigner API',
    version: '1.0.0',
    description:
      'REST API for uploading leads, managing email templates with {{placeholders}}, launching email campaigns, and inspecting delivery stats.',
  },
  servers: [
    {
      url: '/',
      description: 'Current API server',
    },
  ],
  tags: [
    { name: 'Health', description: 'API and database health check' },
    { name: 'Leads', description: 'Upload and list campaign leads' },
    { name: 'Templates', description: 'Create, list, edit, and delete email templates' },
    { name: 'Campaigns', description: 'Start campaigns and check delivery stats' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Check API and database connectivity',
        responses: {
          200: { description: 'Service is healthy' },
          503: { description: 'Database unreachable' },
        },
      },
    },
    '/leads/upload': {
      post: {
        tags: ['Leads'],
        summary: 'Upload leads via CSV file (skips duplicate emails)',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'CSV file with columns: name, email, company',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'CSV parsed and leads inserted' },
          400: { description: 'Missing file or invalid CSV data' },
        },
      },
    },
    '/leads': {
      get: {
        tags: ['Leads'],
        summary: 'List all leads',
        responses: {
          200: { description: 'Array of leads' },
        },
      },
    },
    '/templates': {
      get: {
        tags: ['Templates'],
        summary: 'List all email templates',
        responses: {
          200: { description: 'Array of templates' },
        },
      },
      post: {
        tags: ['Templates'],
        summary: 'Create an email template',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'subject', 'body'],
                properties: {
                  name: { type: 'string', example: 'Product Intro' },
                  subject: {
                    type: 'string',
                    example: 'Quick idea for {{company}}',
                  },
                  body: {
                    type: 'string',
                    example: 'Hi {{name}},\n\nThought this might help {{company}}.',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Template created' },
          400: { description: 'Validation error' },
        },
      },
    },
    '/templates/{id}': {
      put: {
        tags: ['Templates'],
        summary: 'Update an existing template',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'subject', 'body'],
                properties: {
                  name: { type: 'string' },
                  subject: { type: 'string' },
                  body: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Template updated' },
          400: { description: 'Validation error' },
          404: { description: 'Template not found' },
        },
      },
      delete: {
        tags: ['Templates'],
        summary: 'Delete a template',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          200: { description: 'Template deleted' },
          404: { description: 'Template not found' },
          409: { description: 'Template is referenced by an existing campaign' },
        },
      },
    },
    '/campaigns': {
      get: {
        tags: ['Campaigns'],
        summary: 'List all campaigns with delivery stats',
        responses: {
          200: { description: 'Array of campaigns' },
        },
      },
      post: {
        tags: ['Campaigns'],
        summary: 'Start a campaign and queue one pending email_log per lead',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'template_id'],
                properties: {
                  name: { type: 'string', example: 'Q4 Outreach' },
                  template_id: { type: 'integer', example: 1 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Campaign created and emails queued' },
          400: { description: 'Validation error or no leads available' },
          404: { description: 'Template not found' },
        },
      },
    },
    '/campaigns/{id}/stats': {
      get: {
        tags: ['Campaigns'],
        summary: 'Get sent, failed, and pending counts plus email logs for a campaign',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          200: { description: 'Campaign stats and recipient logs' },
          400: { description: 'Invalid campaign ID' },
          404: { description: 'Campaign not found' },
        },
      },
    },
  },
};
