import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface Category {
  id: string;
  name: string;
}

interface CategoryTabsProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
}

export const CategoryTabs = ({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryTabsProps) => {
  return (
    <div className="border-b border-border bg-muted/30">
      <ScrollArea className="w-full">
        <div className="flex gap-2 p-3">
          <Button
            variant={selectedCategory === null ? "default" : "ghost"}
            size="sm"
            onClick={() => onSelectCategory(null)}
            className="shrink-0"
          >
            All Items
          </Button>
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "ghost"}
              size="sm"
              onClick={() => onSelectCategory(category.id)}
              className="shrink-0"
            >
              {category.name}
            </Button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};
