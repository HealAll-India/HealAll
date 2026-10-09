interface Props {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}

/** Page title (display face) with an optional one-line subtitle and actions. */
export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        <h1 className="page-header__title">{title}</h1>
        {subtitle ? <p className="page-header__sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
