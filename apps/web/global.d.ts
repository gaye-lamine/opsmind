// Type declarations for CSS side-effect imports in Next.js
// This allows `import "./globals.css"` without TypeScript errors

declare module "*.css" {
  const styles: { readonly [key: string]: string };
  export default styles;
}
