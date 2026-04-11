import { getBooksDashboardData } from '@/app/actions/books';
import BooksTableModeClient from './BooksTableModeClient';

export const dynamic = 'force-dynamic';

export default async function BooksPage() {
  const data = await getBooksDashboardData();
  
  return <BooksTableModeClient initialData={data} />;
}
