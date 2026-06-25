# Carelane Email Signatures

Professional email signature templates using the Carelane logo system.

## Logo Guidelines for Email

- **Preferred**: `carelane-logo-navy-transparent.png` / `carelane-logo-gradient-white-transparent.png` for dark or neutral email backgrounds
- **Alternative**: `carelane-logo-navy-transparent.png` for white / light email backgrounds
- **Size**: 180–240px width for email signatures (SVG scales crisply)
- **Background**: image-heavy dark backgrounds work best with `carelane-logo-white-transparent.png`

## HTML Email Signature Template

Use this template for email client signatures:

```html
<table style="width: 280px; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;">
  <!-- Logo -->
  <tr>
    <td style="padding-bottom: 16px;">
      <img 
        src="https://carelane.nl/brand/logos/png/carelane-logo-gradient-white-transparent.png" 
        alt="Carelane" 
        width="200" 
        height="auto" 
        style="max-width: 200px; height: auto; display: block;"
      />
    </td>
  </tr>

  <!-- User info -->
  <tr>
    <td style="padding-bottom: 12px;">
      <div style="font-weight: 600; font-size: 14px; color: #0f172a; margin-bottom: 2px;">
        [Your Name]
      </div>
      <div style="font-size: 13px; color: #64748b; margin-bottom: 6px;">
        [Your Role]
      </div>
      <div style="font-size: 12px; color: #94a3b8; margin-bottom: 12px;">
        [Organization Name]
      </div>
    </td>
  </tr>

  <!-- Contact info -->
  <tr>
    <td style="border-top: 1px solid #e2e8f0; padding-top: 12px;">
      <div style="font-size: 12px; color: #64748b; line-height: 1.6;">
        <div>📧 <a href="mailto:[email]" style="color: #0f172a; text-decoration: none;">[email]</a></div>
        <div>📱 <a href="tel:[phone]" style="color: #0f172a; text-decoration: none;">[phone]</a></div>
        <div>🌐 <a href="https://carelane.nl" style="color: #0f172a; text-decoration: none;">carelane.nl</a></div>
      </div>
    </td>
  </tr>

  <!-- Legal disclaimer -->
  <tr>
    <td style="padding-top: 12px; border-top: 1px solid #e2e8f0;">
      <div style="font-size: 11px; color: #94a3b8; line-height: 1.5;">
        Dit e-mailbericht is vertrouwelijk en bedoeld voor de geadresseerde. Gebruik ervan is alleen toegestaan voor het beoogde doel.
      </div>
    </td>
  </tr>
</table>
```

## Dark Background Signature

For dark email templates (uncommon but supported):

```html
<table style="width: 280px; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; background-color: #0f172a; padding: 20px; border-radius: 8px;">
  <!-- Logo -->
  <tr>
    <td style="padding-bottom: 16px;">
      <img 
        src="https://carelane.nl/brand/logos/png/carelane-logo-white-transparent.png" 
        alt="Carelane" 
        width="200" 
        height="auto" 
        style="max-width: 200px; height: auto; display: block;"
      />
    </td>
  </tr>

  <!-- User info (white text) -->
  <tr>
    <td style="padding-bottom: 12px;">
      <div style="font-weight: 600; font-size: 14px; color: #f1f5f9; margin-bottom: 2px;">
        [Your Name]
      </div>
      <div style="font-size: 13px; color: #cbd5e1; margin-bottom: 6px;">
        [Your Role]
      </div>
      <div style="font-size: 12px; color: #94a3b8; margin-bottom: 12px;">
        [Organization Name]
      </div>
    </td>
  </tr>

  <!-- Contact info -->
  <tr>
    <td style="border-top: 1px solid rgba(203, 213, 225, 0.2); padding-top: 12px;">
      <div style="font-size: 12px; color: #cbd5e1; line-height: 1.6;">
        <div>📧 <a href="mailto:[email]" style="color: #f1f5f9; text-decoration: none;">[email]</a></div>
        <div>📱 <a href="tel:[phone]" style="color: #f1f5f9; text-decoration: none;">[phone]</a></div>
        <div>🌐 <a href="https://carelane.nl" style="color: #f1f5f9; text-decoration: none;">carelane.nl</a></div>
      </div>
    </td>
  </tr>
</table>
```

## Plain Text Email Signature

For plain text email clients:

```
---
Carelane | Operationele regie voor zorgcoördinatie

[Your Name]
[Your Role]
[Organization Name]

📧 [email]
📱 [phone]
🌐 carelane.nl

Vertrouwelijk en beveiligd | AVG-bewust | Gebouwd voor de zorg
```

## Implementation Guide

### For Team Members

1. **Copy the HTML template** above matching your background preference
2. **Replace placeholders**: `[Your Name]`, `[Your Role]`, `[Organization Name]`, `[email]`, `[phone]`
3. **Paste into your email client**:
   - **Gmail**: Settings → Signature → Paste HTML
   - **Outlook**: File → Options → Mail → Signatures → New Signature
   - **Apple Mail**: Mail → Preferences → Signatures → Create New

### For Email Systems

If configuring organization-wide email templates:

1. **Use `carelane-logo-navy-transparent.png` / `carelane-logo-gradient-white-transparent.png`** (recommended) or `carelane-logo-navy-transparent.png`
2. **Host logos** on CDN or organization server
3. **Test rendering** in major email clients (Gmail, Outlook, Apple Mail)
4. **Provide plain text fallback** for plain text email clients

## Logo URLs

Use these URLs in your email templates (once deployed):

```
https://carelane.nl/brand/logos/png/carelane-logo-gradient-white-transparent.png
https://carelane.nl/brand/logos/png/carelane-logo-navy-transparent.png
https://carelane.nl/brand/logos/png/carelane-logo-primary-dark-bg.png
https://carelane.nl/brand/logos/png/carelane-logo-white-transparent.png
https://carelane.nl/brand/icons/carelane-app-icon-512.png
https://carelane.nl/brand/icons/favicon.ico
```

## Best Practices

✅ **Do:**
- Use PNG or SVG formats (not JPEG for logos)
- Optimize image file size (use SVG when possible, <10KB)
- Set explicit `alt` text for accessibility
- Include `width` and `height` attributes
- Test in multiple email clients before deployment
- Keep signature height under 200px for mobile
- Use `carelane-logo-navy-transparent.png` / `carelane-logo-gradient-white-transparent.png` on neutral/dark, `carelane-logo-navy-transparent.png` on white

❌ **Don't:**
- Use the tagline lockup in emails (too tall — `carelane-logo-primary-dark-bg.png` is marketing-only)
- Embed large raster images (use < 50KB total signature size)
- Use animations or interactive elements
- Link the logo to external tracking pixels
- Include personally identifying information (PII) in unencrypted plain text

## Support

For logo system questions or email template support:
- See `/components/logos/README.md` for logo variants and usage
- Check design system documentation at `carelane-landing-design-kit/`
- Contact: design@carelane.nl
