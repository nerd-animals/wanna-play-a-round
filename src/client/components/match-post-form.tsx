"use client";

import { useState } from "react";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Textarea } from "@/client/components/ui/textarea";

type MatchPostFormProps = {
  action: string;
  cancelHref: string;
  tiers: readonly string[];
};

export function MatchPostForm({ action, cancelHref, tiers }: MatchPostFormProps) {
  const [minTier, setMinTier] = useState("");
  const [maxTier, setMaxTier] = useState("");

  return (
    <form action={action} method="post" className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="title">제목</Label>
        <Input id="title" name="title" placeholder="금요일 5:5 스크림 구합니다" required />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">설명</Label>
        <Textarea
          id="description"
          name="description"
          rows={5}
          placeholder="평균 티어, 시작 시간, 요청 사항 등을 적어주세요"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>최소 티어</Label>
          <input type="hidden" name="minTier" value={minTier} />
          <Select value={minTier} onValueChange={setMinTier}>
            <SelectTrigger>
              <SelectValue placeholder="선택 안 함" />
            </SelectTrigger>
            <SelectContent>
              {tiers.map((tier) => (
                <SelectItem key={tier} value={tier}>
                  {tier}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>최대 티어</Label>
          <input type="hidden" name="maxTier" value={maxTier} />
          <Select value={maxTier} onValueChange={setMaxTier}>
            <SelectTrigger>
              <SelectValue placeholder="선택 안 함" />
            </SelectTrigger>
            <SelectContent>
              {tiers.map((tier) => (
                <SelectItem key={tier} value={tier}>
                  {tier}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="availableTime">가능 시간</Label>
        <Input id="availableTime" name="availableTime" type="datetime-local" />
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <Button type="submit">매칭 등록</Button>
        <Button asChild variant="outline">
          <a href={cancelHref}>돌아가기</a>
        </Button>
      </div>
    </form>
  );
}
