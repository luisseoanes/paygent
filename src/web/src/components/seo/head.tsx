import { siteConfig } from '@/config/site';

type HeadProps = {
  title?: string;
  description?: string;
};

// React 19 hoists <title> and <meta> to the document <head> automatically.
export const Head = ({ title, description }: HeadProps = {}) => {
  return (
    <>
      <title>{title ? `${title} | ${siteConfig.name}` : siteConfig.name}</title>
      <meta
        name="description"
        content={description ?? siteConfig.description}
      />
    </>
  );
};
