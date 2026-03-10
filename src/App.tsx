/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Check, 
  Plus, 
  Trash2, 
  Search, 
  Package, 
  Clock, 
  CheckCircle2, 
  User, 
  Scissors,
  ChevronRight,
  AlertCircle,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './supabaseClient';

interface Order {
  id: string;
  number: string;
  kurta: string;
  pant: string;
  shirt: string;
  delivered: boolean;
  createdAt: string; // Changed to ISO string for better DB compatibility
}

const initialData: Order[] = [
  { id: '1', number: '1669', kurta: 'No', pant: '1 Pic', shirt: '', delivered: false, createdAt: new Date(Date.now() - 500000).toISOString() },
  { id: '2', number: '1711', kurta: 'Baki', pant: '1 Pic', shirt: '', delivered: false, createdAt: new Date(Date.now() - 400000).toISOString() },
  { id: '3', number: '1696', kurta: '1 Pic', pant: 'Baki', shirt: '', delivered: false, createdAt: new Date(Date.now() - 300000).toISOString() },
  { id: '4', number: 'D.R. IRFAN', kurta: '1 Pic', pant: 'No', shirt: '', delivered: false, createdAt: new Date(Date.now() - 200000).toISOString() },
  { id: '5', number: '1685', kurta: '1 Pic', pant: '1 Pic', shirt: '', delivered: false, createdAt: new Date(Date.now() - 100000).toISOString() },
  { id: '6', number: '1587', kurta: '1 Pic', pant: '1 Pic', shirt: '', delivered: true, createdAt: new Date().toISOString() },
];

const QUICK_VALUES = ['1 Pic', 'Baki', 'No', 'Urgent'];

export default function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'delivered'>('all');
  
  // New Order Form State
  const [newOrder, setNewOrder] = useState({
    number: '',
    kurta: '',
    pant: '',
    shirt: ''
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) {
        console.error('Supabase fetch error:', error);
        throw error;
      }
      setOrders(data || []);
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);
      // If table doesn't exist, we'll keep empty orders but show warning
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders
      .filter(order => {
        const matchesSearch = 
          order.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.kurta.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.pant.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.shirt.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (activeTab === 'pending') return matchesSearch && !order.delivered;
        if (activeTab === 'delivered') return matchesSearch && order.delivered;
        return matchesSearch;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, searchTerm, activeTab]);

  const toggleDelivered = async (id: string) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const newStatus = !order.delivered;
    
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === id ? { ...o, delivered: newStatus } : o));

    try {
      const { error } = await supabase
        .from('orders')
        .update({ delivered: newStatus })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to update order:', err);
      // Rollback on error
      setOrders(prev => prev.map(o => o.id === id ? { ...o, delivered: !newStatus } : o));
    }
  };

  const deleteOrder = async (id: string) => {
    if (!window.confirm('Delete this order record?')) return;

    // Optimistic update
    const previousOrders = [...orders];
    setOrders(prev => prev.filter(o => o.id !== id));

    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to delete order:', err);
      setOrders(previousOrders);
    }
  };

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.number) return;

    const order: Order = {
      id: crypto.randomUUID(),
      ...newOrder,
      delivered: false,
      createdAt: new Date().toISOString()
    };

    // Optimistic update
    setOrders(prev => [order, ...prev]);
    setNewOrder({ number: '', kurta: '', pant: '', shirt: '' });

    try {
      if (!supabase) throw new Error('Supabase not initialized');
      const { error } = await supabase
        .from('orders')
        .insert([order]);

      if (error) throw error;
    } catch (err: any) {
      console.error('Failed to save order:', err);
      alert(`Error: ${err.message || 'Failed to save to database'}. Make sure the "orders" table exists and RLS is disabled or has a public policy.`);
      setOrders(prev => prev.filter(o => o.id !== order.id));
    }
  };

  const setQuickValue = (field: 'kurta' | 'pant' | 'shirt', value: string) => {
    setNewOrder(prev => ({ ...prev, [field]: value }));
  };

  const downloadCSV = () => {
    if (orders.length === 0) return;

    const headers = ['Order Number', 'Kurta', 'Pant', 'Shirt', 'Status', 'Date'];
    const csvRows = [
      headers.join(','),
      ...orders.map(order => [
        `"${order.number}"`,
        `"${order.kurta}"`,
        `"${order.pant}"`,
        `"${order.shirt}"`,
        order.delivered ? 'Delivered' : 'Pending',
        new Date(order.createdAt).toLocaleDateString()
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `tailor_orders_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-200">
            <Scissors className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">TailorFlow</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Order Management System</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          {(['all', 'pending', 'delivered'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize ${
                activeTab === tab 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search orders..."
              className="w-full bg-slate-100 border-none pl-10 pr-4 py-2 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={downloadCSV}
            title="Download CSV"
            className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm active:scale-95"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Entry Form */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 sticky top-28">
            <div className="flex items-center gap-2 mb-6">
              <Plus className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold">Quick Entry</h2>
            </div>

            <form onSubmit={handleAddOrder} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Order Number / Customer</label>
                <input 
                  required
                  type="text" 
                  placeholder="e.g. 1720 or Rahul"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  value={newOrder.number}
                  onChange={e => setNewOrder({...newOrder, number: e.target.value})}
                />
              </div>

              {(['kurta', 'pant', 'shirt'] as const).map((field) => (
                <div key={field} className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider capitalize">{field} Details</label>
                  <input 
                    type="text" 
                    placeholder={`Enter ${field} status...`}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                    value={newOrder[field]}
                    onChange={e => setNewOrder({...newOrder, [field]: e.target.value})}
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {QUICK_VALUES.map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setQuickValue(field, val)}
                        className="px-2 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-[10px] font-bold rounded-md transition-colors text-slate-500 border border-transparent hover:border-indigo-200"
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <button 
                type="submit" 
                className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                Save Order
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Order List */}
        <div className="lg:col-span-8 space-y-4">
          {!supabase && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-amber-900 font-bold">Supabase Setup Required</h3>
                  <p className="text-amber-700 text-sm mt-1">
                    To save your data permanently, please follow these steps:
                  </p>
                  <ol className="text-amber-700 text-xs mt-2 list-decimal list-inside space-y-1">
                    <li>Create the <b>orders</b> table in Supabase SQL Editor.</li>
                    <li><b>Disable RLS</b> for the orders table OR add a <b>Public Insert/Select</b> policy.</li>
                    <li>Add your credentials in the <b>Secrets</b> panel (if not already done).</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center px-2">
            <h2 className="text-lg font-bold flex items-center gap-2">
              Recent Orders
              <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full">{filteredOrders.length}</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredOrders.map((order) => (
                <motion.div
                  layout
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`group bg-white rounded-2xl p-5 shadow-sm border transition-all hover:shadow-md ${
                    order.delivered ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <button 
                        onClick={() => toggleDelivered(order.id)}
                        className={`mt-1 w-10 h-10 rounded-xl flex items-center justify-center transition-all border-2 ${
                          order.delivered 
                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100' 
                            : 'bg-white border-slate-200 text-slate-300 hover:border-indigo-500 hover:text-indigo-500'
                        }`}
                      >
                        <Check className={`w-6 h-6 transition-transform ${order.delivered ? 'scale-110' : 'scale-75 opacity-0 group-hover:opacity-100 group-hover:scale-100'}`} />
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={`text-lg font-bold ${order.delivered ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                            {order.number}
                          </h3>
                          {order.delivered ? (
                            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Delivered</span>
                          ) : (
                            <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Pending</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-slate-400 text-xs font-medium">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(order.createdAt).toLocaleDateString()}</span>
                          <span className="flex items-center gap-1"><User className="w-3 h-3" /> Customer Record</span>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => deleteOrder(order.id)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-3">
                    {[
                      { label: 'Kurta', value: order.kurta },
                      { label: 'Pant', value: order.pant },
                      { label: 'Shirt', value: order.shirt }
                    ].map((item) => (
                      <div key={item.label} className={`p-3 rounded-xl border ${
                        order.delivered ? 'bg-white/50 border-slate-100' : 'bg-slate-50 border-slate-100'
                      }`}>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                        <p className={`text-sm font-bold ${
                          !item.value || item.value === 'No' ? 'text-slate-300' : 'text-slate-700'
                        }`}>
                          {item.value || '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredOrders.length === 0 && (
              <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-slate-200">
                <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-slate-900 font-bold">No orders found</h3>
                <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filters.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Mobile Stats Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 z-40 md:hidden">
        <div className="flex flex-col">
          <span className="text-[8px] text-slate-400 uppercase font-bold tracking-widest">Total</span>
          <span className="text-sm font-bold">{orders.length}</span>
        </div>
        <div className="w-px h-6 bg-slate-700" />
        <div className="flex flex-col">
          <span className="text-[8px] text-slate-400 uppercase font-bold tracking-widest">Pending</span>
          <span className="text-sm font-bold text-amber-400">{orders.filter(o => !o.delivered).length}</span>
        </div>
        <div className="w-px h-6 bg-slate-700" />
        <div className="flex flex-col">
          <span className="text-[8px] text-slate-400 uppercase font-bold tracking-widest">Done</span>
          <span className="text-sm font-bold text-emerald-400">{orders.filter(o => o.delivered).length}</span>
        </div>
      </div>
    </div>
  );
}
