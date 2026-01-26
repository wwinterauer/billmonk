import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingDown, 
  TrendingUp, 
  Receipt, 
  Sparkles, 
  Plus,
  ArrowRight,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { motion } from 'framer-motion';

const statsCards = [
  {
    title: 'Ausgaben',
    value: '€ 2.847,50',
    change: '↓ 12% vs. Vormonat',
    changeType: 'positive' as const,
    icon: TrendingDown,
  },
  {
    title: 'Vorsteuer',
    value: '€ 474,58',
    change: 'Dieser Monat',
    changeType: 'neutral' as const,
    icon: Receipt,
  },
  {
    title: 'Belege erfasst',
    value: '47',
    change: '3 noch offen',
    changeType: 'warning' as const,
    icon: Receipt,
  },
  {
    title: 'Erkennungsrate',
    value: '94%',
    change: 'KI-Genauigkeit',
    changeType: 'positive' as const,
    icon: Sparkles,
  },
];

const recentReceipts = [
  { id: 1, date: '24.01.2025', supplier: 'Amazon Business', amount: '€ 89,90', status: 'Freigegeben' },
  { id: 2, date: '23.01.2025', supplier: 'Deutsche Bahn', amount: '€ 156,00', status: 'Freigegeben' },
  { id: 3, date: '22.01.2025', supplier: 'MediaMarkt', amount: '€ 249,99', status: 'Review' },
  { id: 4, date: '21.01.2025', supplier: 'Tankstelle Shell', amount: '€ 65,40', status: 'Offen' },
  { id: 5, date: '20.01.2025', supplier: 'IKEA', amount: '€ 189,00', status: 'Freigegeben' },
];

const Dashboard = () => {
  const [selectedMonth, setSelectedMonth] = useState('januar-2025');

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Übersicht deiner Ausgaben</p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-48">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Monat wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="januar-2025">Januar 2025</SelectItem>
                <SelectItem value="dezember-2024">Dezember 2024</SelectItem>
                <SelectItem value="november-2024">November 2024</SelectItem>
              </SelectContent>
            </Select>
            <Link to="/upload">
              <Button className="gradient-primary hover:opacity-90">
                <Plus className="h-4 w-4 mr-2" />
                Beleg hochladen
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statsCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card className="border-border/50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-muted-foreground">{stat.title}</span>
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <stat.icon className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-foreground mb-1">{stat.value}</p>
                  <p className={`text-sm ${
                    stat.changeType === 'positive' ? 'text-success' :
                    stat.changeType === 'warning' ? 'text-warning' :
                    'text-muted-foreground'
                  }`}>
                    {stat.change}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Receipts */}
          <motion.div 
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Letzte Belege</CardTitle>
                <Link to="/expenses">
                  <Button variant="ghost" size="sm">
                    Alle anzeigen
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentReceipts.map((receipt) => (
                    <div
                      key={receipt.id}
                      className="flex items-center justify-between py-3 border-b border-border/50 last:border-0"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                          <Receipt className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{receipt.supplier}</p>
                          <p className="text-sm text-muted-foreground">{receipt.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-medium text-foreground">{receipt.amount}</span>
                        <Badge 
                          variant={
                            receipt.status === 'Freigegeben' ? 'default' :
                            receipt.status === 'Review' ? 'secondary' :
                            'outline'
                          }
                          className={
                            receipt.status === 'Freigegeben' ? 'bg-success hover:bg-success' :
                            receipt.status === 'Review' ? 'bg-warning hover:bg-warning text-warning-foreground' :
                            ''
                          }
                        >
                          {receipt.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Sidebar Content */}
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            {/* Actions Required */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Aktionen erforderlich</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">5 Belege</p>
                    <p className="text-sm text-muted-foreground">warten auf Review</p>
                  </div>
                  <Link to="/review">
                    <Button size="sm" variant="outline">Prüfen</Button>
                  </Link>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">3 Buchungen</p>
                    <p className="text-sm text-muted-foreground">nicht zugeordnet</p>
                  </div>
                  <Link to="/matching">
                    <Button size="sm" variant="outline">Abgleichen</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Category Chart Placeholder */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Ausgaben nach Kategorie</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-center justify-center bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <div className="w-24 h-24 rounded-full border-8 border-primary mx-auto mb-4 relative">
                      <div className="absolute inset-2 rounded-full border-8 border-success"></div>
                      <div className="absolute inset-4 rounded-full border-8 border-warning"></div>
                    </div>
                    <p className="text-sm text-muted-foreground">Diagramm</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Floating Action Button */}
      <Link 
        to="/upload"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full gradient-primary shadow-primary flex items-center justify-center hover:opacity-90 transition-opacity lg:hidden"
      >
        <Plus className="h-6 w-6 text-primary-foreground" />
      </Link>
    </DashboardLayout>
  );
};

export default Dashboard;
