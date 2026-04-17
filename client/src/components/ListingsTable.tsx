import { ExternalLink, Pause, StopCircle, RefreshCw, MoreVertical } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Card } from "./ui/card";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Listing, ListingStatus } from "../lib/listingsData";
import { Language, t } from "../lib/i18n";

interface ListingsTableProps {
  listings: Listing[];
  language: Language;
}

export function ListingsTable({ listings, language }: ListingsTableProps) {
  const formatPrice = (price: number) => {
    const locale = language === "fr" ? "fr-FR" : "en-GB";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const formatDate = (date: Date) => {
    const locale = language === "fr" ? "fr-FR" : "en-GB";
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const formatShortDate = (date: Date) => {
    const locale = language === "fr" ? "fr-FR" : "en-GB";
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getStatusLabel = (status: ListingStatus) => {
    return t(language, `publisher.status.${status}`);
  };

  const statusConfig: Record<
    ListingStatus,
    { className: string }
  > = {
    queued: {
      className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    },
    posting: {
      className: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    },
    active: {
      className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    },
    failed: {
      className: "bg-red-500/20 text-red-400 border-red-500/30",
    },
    ended: {
      className: "bg-muted/30 text-muted-foreground/70 border-muted/50",
    },
    paused: {
      className: "bg-muted/50 text-muted-foreground border-muted",
    },
  };

  return (
    <>
      {/* Desktop table */}
      <div className="hidden lg:block">
        <div className="rounded-2xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-20"></TableHead>
                <TableHead className="w-[320px]">{t(language, "publisher.columns.title")}</TableHead>
                <TableHead className="w-[140px]">{t(language, "publisher.columns.sku")}</TableHead>
                <TableHead className="w-[160px]">{t(language, "publisher.columns.account")}</TableHead>
                <TableHead className="w-[160px]">{t(language, "publisher.columns.status")}</TableHead>
                <TableHead className="w-[120px]">{t(language, "publisher.columns.price")}</TableHead>
                <TableHead className="w-[160px]">{language === "fr" ? "Publié le" : "Published on"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listings.map((listing) => (
                <TableRow key={listing.id} className="hover:bg-muted/20">
                  <TableCell>
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted">
                      {listing.photoUrl && (
                        <ImageWithFallback
                          src={listing.photoUrl}
                          alt={listing.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-foreground line-clamp-2 text-sm max-w-xs">
                      {listing.title}
                    </p>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs text-muted-foreground">
                      {listing.sku}
                    </code>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground">
                      {listing.accountName}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start gap-1">
                      <Badge
                        variant="outline"
                        className={`${statusConfig[listing.status].className} rounded-xl text-xs whitespace-nowrap`}
                      >
                        {getStatusLabel(listing.status)}
                      </Badge>
                    </div>
                    {listing.errorMessage && (
                      <p className="text-xs text-red-400 mt-1 line-clamp-1 max-w-[140px]" title={listing.errorMessage}>
                        {listing.errorMessage}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground">
                      {formatPrice(listing.price)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatShortDate(listing.lastSync)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {listings.map((listing) => (
          <Card
            key={listing.id}
            className="rounded-2xl border border-border p-4"
          >
            <div className="flex gap-3">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted shrink-0">
                {listing.photoUrl && (
                  <ImageWithFallback
                    src={listing.photoUrl}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-foreground line-clamp-2 text-sm">
                    {listing.title}
                  </h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-2xl">
                      <DropdownMenuItem>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {t(language, "publisher.actions.viewOnVinted")}
                      </DropdownMenuItem>
                      {listing.status === "active" && (
                        <>
                          <DropdownMenuItem>
                            <Pause className="h-4 w-4 mr-2" />
                            {t(language, "publisher.actions.pause")}
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <StopCircle className="h-4 w-4 mr-2" />
                            {t(language, "publisher.actions.end")}
                          </DropdownMenuItem>
                        </>
                      )}
                      {listing.status === "failed" && (
                        <DropdownMenuItem>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          {t(language, "publisher.actions.retry")}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <code>{listing.sku}</code>
                    <span>•</span>
                    <span>{listing.accountName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{formatPrice(listing.price)}</span>
                    <Badge
                      variant="outline"
                      className={`${statusConfig[listing.status].className} rounded-xl`}
                    >
                      {getStatusLabel(listing.status)}
                    </Badge>
                  </div>
                  {listing.errorMessage && (
                    <p className="text-red-400">{listing.errorMessage}</p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}