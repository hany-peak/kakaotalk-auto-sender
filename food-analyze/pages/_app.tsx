import type { AppProps } from 'next/app';
import '../globals.css'; // Make sure this path is correct for your project structure
import Layout from '../components/Layout'; // Import the Layout component

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}

export default MyApp; 