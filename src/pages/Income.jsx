import { useEffect, useMemo, useState } from "react";
import { db } from "../services/supabase";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString("uk-UA", { maximumFractionDigits: 2 });
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0,0,0,0);
  return d;
}

export default function Income() {
  const [range, setRange] = useState("all"); // all | 7 | 30 | 180
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [daily, setDaily] = useState([]); // [{day, profit, revenue, cost, orders}]
  const [summaryAll, setSummaryAll] = useState({ profit: 0, revenue: 0, cost: 0, orders: 0 });

  async function load() {
    setLoading(true);
    setErr("");
    try {
      // тягнемо останні 180 днів (для всіх кнопок, крім "all" вистачить)
      const from180 = daysAgo(180).toISOString();
      const { data: d, error: e1 } = await db
        .from("profit_daily")
        .select("*")
        .gte("day", from180)
        .order("day", { ascending: true });

      if (e1) throw e1;
      const arr = (d ?? []).map((x) => ({
        ...x,
        profit: Number(x.profit || 0),
        revenue: Number(x.revenue || 0),
        cost: Number(x.cost || 0),
        orders: Number(x.orders || 0),
      }));
      setDaily(arr);

      // загально (all time) — рахуємо через item_events (без view-агрегацій)
      const { data: ev, error: e2 } = await db
        .from("item_events")
        .select("type, qty, cost, sale_price")
        .in("type", ["delivered", "return"])
        .limit(100000); // для приватного використання ок

      if (e2) throw e2;

      let profit = 0, revenue = 0, cost = 0, orders = 0;
      for (const r of ev ?? []) {
        const qty = Number(r.qty || 0);
        const c = Number(r.cost || 0);
        const p = Number(r.sale_price || 0);

        if (r.type === "delivered") {
          profit += (p - c) * qty;
          revenue += p * qty;
          cost += c * qty;
          orders += 1;
        } else if (r.type === "return") {
          profit -= (p - c) * qty;
          revenue -= p * qty;
          cost -= c * qty;
        }
      }
      setSummaryAll({ profit, revenue, cost, orders });
    } catch (e) {
      setErr(e?.message ?? "Помилка");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filteredDaily = useMemo(() => {
    if (range === "all") return daily;
    const n = Number(range);
    const from = daysAgo(n);
    return daily.filter((x) => new Date(x.day) >= from);
  }, [daily, range]);

  const summary = useMemo(() => {
    if (range === "all") return summaryAll;

    let profit = 0, revenue = 0, cost = 0, orders = 0;
    for (const x of filteredDaily) {
      profit += x.profit;
      revenue += x.revenue;
      cost += x.cost;
      orders += x.orders;
    }
    return { profit, revenue, cost, orders };
  }, [filteredDaily, range, summaryAll]);

  const margin = summary.revenue !== 0 ? (summary.profit / summary.revenue) * 100 : 0;

  return (
    <section>
      <div className="incomeTop">
        <div className="seg">
          <button className={`segBtn ${range==="all" ? "active" : ""}`} onClick={() => setRange("all")} type="button">Загально</button>
          <button className={`segBtn ${range==="7" ? "active" : ""}`} onClick={() => setRange("7")} type="button">Тиждень</button>
          <button className={`segBtn ${range==="30" ? "active" : ""}`} onClick={() => setRange("30")} type="button">Місяць</button>
          <button className={`segBtn ${range==="180" ? "active" : ""}`} onClick={() => setRange("180")} type="button">Пів року</button>
        </div>

        <button className="btnSecondary" type="button" onClick={load}>Оновити</button>
      </div>

      {err ? <div className="errorBox">{err}</div> : null}
      {loading ? <p style={{ marginTop: 10 }}>Завантаження...</p> : null}

      <div className="incomeCards">
        <div className="homeMetric">
          <div className="homeMetricLabel">Прибуток</div>
          <div className="homeMetricValue">₴ {money(summary.profit)}</div>
        </div>
        <div className="homeMetric">
          <div className="homeMetricLabel">Виручка</div>
          <div className="homeMetricValue">₴ {money(summary.revenue)}</div>
        </div>
        <div className="homeMetric">
          <div className="homeMetricLabel">Собівартість</div>
          <div className="homeMetricValue">₴ {money(summary.cost)}</div>
        </div>
        <div className="homeMetric">
          <div className="homeMetricLabel">Всього замовлень</div>
          <div className="homeMetricValue">{summary.orders}</div>
          <div className="homeMetricHint">кількість подій “Отримано”</div>
        </div>
        <div className="homeMetric">
          <div className="homeMetricLabel">Маржа</div>
          <div className="homeMetricValue">{margin.toFixed(1)}%</div>
        </div>
      </div>

      <div className="chartCard">
        <div className="chartTitle">Прибуток по днях</div>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredDaily}>
              <CartesianGrid stroke="rgba(11,18,32,.08)" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => `₴ ${money(v)}`} />
              <Line type="monotone" dataKey="profit" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}