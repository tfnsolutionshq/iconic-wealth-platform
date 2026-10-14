import { Link } from 'react-router-dom';
import logoMain from '@/assets/brand/logo-main.png';
import logoWhite from '@/assets/brand/logo-white.png';

/** Brand logo. Use `white` on dark backgrounds (footer, admin sidebar, registration panel). */
export function Logo({ white, to = '/', className = 'h-[52px] w-auto' }: { white?: boolean; to?: string; className?: string }) {
  return <Link to={to} aria-label="Iconic Wealth Hub home"><img src={white ? logoWhite : logoMain} alt="Iconic Wealth Hub" className={className} /></Link>;
}
