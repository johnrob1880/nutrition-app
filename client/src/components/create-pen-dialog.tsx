import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus } from "lucide-react";
import type { CreatePenRequest, Pen } from "@shared/schema";

const createPenSchema = z.object({
  name: z.string().min(1, "Pen name is required"),
  capacity: z.number().min(1, "Capacity must be at least 1"),
  current: z.number().min(0, "Current count cannot be negative"),
  cattleType: z.enum(["Steers", "Heifers", "Mixed"]),
  startingWeight: z.number().min(1, "Starting weight must be greater than 0"),
  marketWeight: z.number().min(1, "Market weight must be greater than 0"),
  feedType: z.string().min(1, "Feed type is required"),
  isCrossbred: z.boolean(),
}).refine((data) => data.current <= data.capacity, {
  message: "Current cattle count cannot exceed capacity",
  path: ["current"],
}).refine((data) => data.marketWeight > data.startingWeight, {
  message: "Market weight must be greater than starting weight",
  path: ["marketWeight"],
});

type CreatePenForm = z.infer<typeof createPenSchema>;

interface CreatePenDialogProps {
  operatorEmail: string;
}

export default function CreatePenDialog({ operatorEmail }: CreatePenDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<CreatePenForm>({
    resolver: zodResolver(createPenSchema),
    defaultValues: {
      name: "",
      capacity: 25,
      current: 0,
      cattleType: "Steers",
      startingWeight: 500,
      marketWeight: 1200,
      feedType: "Standard Grain Mix",
      isCrossbred: false,
    },
  });

  const onSubmit = async (data: CreatePenForm) => {
    setIsLoading(true);
    try {
      const penData: CreatePenRequest = {
        ...data,
        operatorEmail,
      };

      await apiRequest("/api/pens", "POST", penData);

      // Invalidate pens cache to refetch the list
      queryClient.invalidateQueries({ queryKey: ["/api/pens", operatorEmail] });
      
      toast({
        title: "Pen created successfully!",
        description: `${data.name} has been added to your operation.`,
      });

      form.reset();
      setOpen(false);
    } catch (error: any) {
      toast({
        title: "Error creating pen",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary-light text-white">
          <Plus className="h-4 w-4 mr-2" />
          Add New Pen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Cattle Pen</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Pen Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Pen A-4"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="capacity">Capacity *</Label>
              <Input
                id="capacity"
                type="number"
                min="1"
                {...form.register("capacity", { valueAsNumber: true })}
              />
              {form.formState.errors.capacity && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.capacity.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="current">Current Count</Label>
              <Input
                id="current"
                type="number"
                min="0"
                {...form.register("current", { valueAsNumber: true })}
              />
              {form.formState.errors.current && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.current.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="cattleType">Cattle Type *</Label>
            <Select
              value={form.watch("cattleType")}
              onValueChange={(value) => form.setValue("cattleType", value as "Steers" | "Heifers" | "Mixed")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select cattle type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Steers">Steers</SelectItem>
                <SelectItem value="Heifers">Heifers</SelectItem>
                <SelectItem value="Mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.cattleType && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.cattleType.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startingWeight">Starting Weight (lbs) *</Label>
              <Input
                id="startingWeight"
                type="number"
                min="1"
                {...form.register("startingWeight", { valueAsNumber: true })}
              />
              {form.formState.errors.startingWeight && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.startingWeight.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="marketWeight">Target Weight (lbs) *</Label>
              <Input
                id="marketWeight"
                type="number"
                min="1"
                {...form.register("marketWeight", { valueAsNumber: true })}
              />
              {form.formState.errors.marketWeight && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.marketWeight.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="feedType">Feed Type *</Label>
            <Select
              value={form.watch("feedType")}
              onValueChange={(value) => form.setValue("feedType", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select feed type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="High Protein Mix">High Protein Mix</SelectItem>
                <SelectItem value="Standard Grain Mix">Standard Grain Mix</SelectItem>
                <SelectItem value="Finishing Feed">Finishing Feed</SelectItem>
                <SelectItem value="Maintenance Ration">Maintenance Ration</SelectItem>
                <SelectItem value="Custom Mix">Custom Mix</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.feedType && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.feedType.message}</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isCrossbred"
              checked={form.watch("isCrossbred")}
              onCheckedChange={(checked) => form.setValue("isCrossbred", !!checked)}
            />
            <Label htmlFor="isCrossbred">Crossbred cattle</Label>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-primary hover:bg-primary-light"
            >
              {isLoading ? "Creating..." : "Create Pen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}