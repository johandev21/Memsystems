import { useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { LogOut, Settings, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/feedback/spinner";
import { useClerk, useUser } from "@clerk/react";
import { toast } from "sonner";

export function UserMenu() {
  const navigate = useNavigate();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    const toastId = toast.loading("Signing out...");
    try {
      await signOut();
      await router.navigate({ to: "/" });
      await router.invalidate();
      toast.dismiss(toastId);
    } catch {
      toast.error("Failed to sign out. Please try again.", { id: toastId });
      setIsLoggingOut(false);
    }
  }

  const displayName =
    user?.fullName || user?.firstName || user?.username || "Account";
  const primaryEmail = user?.primaryEmailAddress?.emailAddress ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="cursor-pointer" />}
      >
        <div className="size-6 flex items-center justify-center">
          {!isLoaded ? (
            <Skeleton className="size-6 rounded-full" />
          ) : (
            <Avatar size="sm">
              <AvatarImage src={user?.imageUrl} alt={displayName} />
              <AvatarFallback>
                {displayName.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{displayName}</p>
              {primaryEmail ? (
                <p className="text-xs text-muted-foreground">{primaryEmail}</p>
              ) : null}
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => openUserProfile()}
          className="cursor-pointer"
        >
          <UserIcon className="mr-2 size-4" />
          <span>Manage Account</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate({ to: "/settings" })}
          className="cursor-pointer"
        >
          <Settings className="mr-2 size-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => void handleLogout()}
          disabled={isLoggingOut}
          className="cursor-pointer"
        >
          {isLoggingOut ? (
            <Spinner className="mr-2 size-4 text-text-tertiary" />
          ) : (
            <LogOut className="mr-2 size-4" />
          )}
          <span>{isLoggingOut ? "Signing out..." : "Logout"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

