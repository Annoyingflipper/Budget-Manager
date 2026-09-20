import MesadaMark from './MesadaMark';

type Props = {
  /** 'sm' for the in-app header, 'lg' for the auth screens. */
  size?: 'sm' | 'lg';
  className?: string;
};

/**
 * The app's lockup: mark plus name. Single source for what used to be three
 * copy-pasted 💵 + "Budget" blocks in Header, Login and Signup.
 *
 * The mark is aria-hidden on purpose — the visible text already names the
 * app, so labelling both would announce "Mesada Mesada".
 */
export default function Wordmark({ size = 'sm', className }: Props) {
  const markSize = size === 'lg' ? 40 : 24;
  const textClass = size === 'lg' ? 'text-2xl' : 'text-xl';

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <MesadaMark size={markSize} />
      <span className={`font-extrabold ${textClass}`}>Mesada</span>
    </div>
  );
}
