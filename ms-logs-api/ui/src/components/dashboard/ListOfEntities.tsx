interface ListOfEntitiesProps {
  entities: string[];
  isLoading?: boolean;
}

export default function ListOfEntities({ entities, isLoading }: ListOfEntitiesProps) {
  const handleEntityClick = (entity: string, e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const entityId = entity || "without-entity";
    const element = document.getElementById(entityId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (isLoading) {
    return <div className="text-xs text-gray-500">Loading...</div>;
  }

  if (entities.length === 0) {
    return <div className="text-xs text-gray-500">No entities</div>;
  }

  return (
    <nav className="space-y-0.5">
      {entities.map((entity) => {
        const entityId = entity || "without-entity";
        return (
          <a
            key={entity}
            href={`#${entityId}`}
            onClick={(e) => handleEntityClick(entity, e)}
            className="block w-full text-left px-2 py-1.5 rounded-md text-xs text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-150"
          >
            {entity || "Without entity"}
          </a>
        );
      })}
    </nav>
  );
}
