import './globals.css';
import {connection} from 'next/server';
export const metadata = { title: 'Travel Hunter Pro', description: 'Search observed flight fares with clear source coverage.' };
export default async function Layout({ children }) { await connection(); return <html lang="en"><body>{children}</body></html>; }
