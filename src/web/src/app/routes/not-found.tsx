import { Container } from '@/components/layouts';
import { Head } from '@/components/seo';
import { Link } from '@/components/ui/link';
import { Heading, Text } from '@/components/ui/typography';
import { paths } from '@/config/paths';

const NotFoundRoute = () => {
  return (
    <>
      <Head title="Not found" />
      <Container className="flex flex-col items-center gap-4 py-24 text-center">
        <Text
          variant="caption"
          className="font-semibold tracking-widest uppercase"
        >
          404
        </Text>
        <Heading level="h1">Page not found</Heading>
        <Text variant="muted">
          The page you are looking for does not exist.
        </Text>
        <Link to={paths.home.getHref()} replace>
          Go back home
        </Link>
      </Container>
    </>
  );
};

export default NotFoundRoute;
