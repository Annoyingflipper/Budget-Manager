import MesadaMark from './MesadaMark';

type Props = {
  /** 'sm' for the in-app header, 'lg' for the auth screens. */
  size?: 'sm' | 'lg';
  className?: string;
  /**
   * Element that carries the name. Defaults to 'span' — the dashboard
   * header has its own heading structure, so a plain span there is
   * correct. Auth screens (Login/Signup) are standalone pages and should
   * pass as="h1" so screen-reader users get a heading landmark.
   *
   * Deliberately independent of `size`: a large wordmark isn't always a
   * page heading, so tying the two together would be an implicit,
   * surprising shortcut for a later caller.
   */
  as?: 'span' | 'h1';
};

/**
 * The app's lockup: mark plus name. Single source for what used to be three
 * copy-pasted 💵 + "Budget" blocks in Header, Login and Signup.
 *
 * The mark is aria-hidden on purpose — the visible text already names the
 * app, so labelling both would announce "Mesada Mesada".
 */
export default function Wordmark({ size = 'sm', className, as: Tag = 'span' }: Props) {
  const markSize = size === 'lg' ? 40 : 24;
  const textClass = size === 'lg' ? 'text-2xl' : 'text-xl';

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <MesadaMark size={markSize} />
      <Tag className={`font-extrabold ${textClass}`}>Mesada</Tag>
    </div>
  );
}
