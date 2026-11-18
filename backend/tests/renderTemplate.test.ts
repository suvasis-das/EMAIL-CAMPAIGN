import { renderTemplate } from '../src/utils/renderTemplate';

describe('renderTemplate', () => {
  it('replaces {{name}} and {{company}} placeholders', () => {
    const template = 'Hi {{name}}, we noticed {{company}} is growing fast.';
    const result = renderTemplate(template, {
      name: 'Priya',
      company: 'Veridian Cloud',
    });

    expect(result).toBe('Hi Priya, we noticed Veridian Cloud is growing fast.');
  });

  it('handles extra whitespace inside braces and case-insensitive keys', () => {
    const template = 'Hello {{  Name }} from {{ COMPANY }}!';
    const result = renderTemplate(template, {
      name: 'Aarav',
      company: 'Northstar Labs',
    });

    expect(result).toBe('Hello Aarav from Northstar Labs!');
  });

  it('replaces missing or null placeholders with an empty string', () => {
    const template = 'Hi {{name}} ({{company}}) - {{unknown_field}}';
    const result = renderTemplate(template, {
      name: 'Daniel',
      company: null,
    });

    expect(result).toBe('Hi Daniel () - ');
  });

  it('replaces multiple occurrences of the same placeholder', () => {
    const template = '{{name}}, quick question for {{name}} at {{company}}.';
    const result = renderTemplate(template, {
      name: 'Sana',
      company: 'Harborline',
    });

    expect(result).toBe('Sana, quick question for Sana at Harborline.');
  });

  it('returns the original text unchanged when there are no placeholders', () => {
    const template = 'Plain email subject without variables';
    expect(renderTemplate(template, { name: 'Marcus' })).toBe(template);
  });
});
