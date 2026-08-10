import { useState, useEffect, useCallback } from "react";
import { computeCurrentDayNumber, dayNumberToDate, msUntilNextLocalMidnight } from "./utils/planDate";

// Aktif planın `start_date`'ine bağlı, GÜNÜN GERÇEK saatine duyarlı okuma
// hook'u — PlanBoard.jsx'in "N. GÜN" başlığını gerçek bir takvim tarihine
// bağlar. Yazma (start_date'i DEĞİŞTİRME) burada YOK — bkz.
// usePlanStudio.shiftPlanStartDate; bu hook yalnızca OKUR + gece yarısında
// kendini yeniler.
//
// GECE YARISI GEÇİŞİ: `setInterval` ile her saniye/dakika yoklamak yerine
// (gereksiz CPU) YALNIZCA bir sonraki gece yarısına tam olarak kaç ms
// kaldığını hesaplayıp TEK bir setTimeout kurulur; o an gelince state
// güncellenir ve bir sonraki gece yarısı için yeniden zamanlanır.
export default function usePlanDate(startDate) {
  const [currentDayNumber, setCurrentDayNumber] = useState(() => computeCurrentDayNumber(startDate));

  useEffect(() => {
    setCurrentDayNumber(computeCurrentDayNumber(startDate));
    if (!startDate) return undefined;
    let timeoutId;
    const scheduleNext = () => {
      timeoutId = setTimeout(() => {
        setCurrentDayNumber(computeCurrentDayNumber(startDate));
        scheduleNext();
      }, msUntilNextLocalMidnight());
    };
    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [startDate]);

  const dateForDay = useCallback((dayNumber) => (startDate ? dayNumberToDate(startDate, dayNumber) : null), [startDate]);

  return { currentDayNumber, dateForDay };
}
