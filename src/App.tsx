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
  Download,
  FileText,
  Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './supabaseClient';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [currentView, setCurrentView] = useState<'list' | 'create'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  
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

    if (editingId) {
      // Handle Update
      const updatedOrder = {
        ...orders.find(o => o.id === editingId),
        ...newOrder,
      } as Order;

      // Optimistic update
      setOrders(prev => prev.map(o => o.id === editingId ? updatedOrder : o));
      setNewOrder({ number: '', kurta: '', pant: '', shirt: '' });
      setEditingId(null);
      setCurrentView('list');

      try {
        if (!supabase) throw new Error('Supabase not initialized');
        const { error } = await supabase
          .from('orders')
          .update(newOrder)
          .eq('id', editingId);

        if (error) throw error;
      } catch (err: any) {
        console.error('Failed to update order:', err);
        alert(`Error: ${err.message || 'Failed to update database'}`);
        fetchOrders(); // Refresh to original state
      }
    } else {
      // Handle Create
      const order: Order = {
        id: crypto.randomUUID(),
        ...newOrder,
        delivered: false,
        createdAt: new Date().toISOString()
      };

      // Optimistic update
      setOrders(prev => [order, ...prev]);
      setNewOrder({ number: '', kurta: '', pant: '', shirt: '' });
      setCurrentView('list');

      try {
        if (!supabase) throw new Error('Supabase not initialized');
        const { error } = await supabase
          .from('orders')
          .insert([order]);

        if (error) throw error;
      } catch (err: any) {
        console.error('Failed to save order:', err);
        alert(`Error: ${err.message || 'Failed to save to database'}`);
        setOrders(prev => prev.filter(o => o.id !== order.id));
      }
    }
  };

  const startEdit = (order: Order) => {
    setNewOrder({
      number: order.number,
      kurta: order.kurta,
      pant: order.pant,
      shirt: order.shirt
    });
    setEditingId(order.id);
    setCurrentView('create');
  };

  const cancelEdit = () => {
    setNewOrder({ number: '', kurta: '', pant: '', shirt: '' });
    setEditingId(null);
    setCurrentView('list');
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

  const downloadPDF = () => {
    if (orders.length === 0) return;

    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.text('TailorFlow Order Report', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    const tableData = orders.map(order => [
      order.number,
      order.kurta || '-',
      order.pant || '-',
      order.shirt || '-',
      order.delivered ? 'Delivered' : 'Pending',
      new Date(order.createdAt).toLocaleDateString()
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Order #', 'Kurta', 'Pant', 'Shirt', 'Status', 'Date']],
      body: tableData,
      headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
      alternateRowStyles: { fillColor: [248, 250, 252] }, // Slate-50
      margin: { top: 35 },
    });

    doc.save(`tailor_orders_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 md:px-8 py-4 flex flex-col gap-4 shadow-sm">
        {/* Search Bar - Prominent at the top */}
        <div className="relative w-full max-w-5xl mx-auto">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-slate-400" />
          </div>
          <input 
            type="text" 
            placeholder="Search by order number, customer, or details..."
            className="w-full bg-slate-100/50 border-2 border-transparent pl-12 pr-4 py-3.5 text-base rounded-2xl focus:bg-white focus:border-indigo-500/30 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none shadow-sm placeholder:text-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-200 ring-4 ring-white">
              <Scissors className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">TailorFlow</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Smart Order Manager</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl w-full md:w-auto border border-slate-200/50">
            {(['all', 'pending', 'delivered'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 md:flex-none px-5 py-2 text-xs font-bold rounded-xl transition-all capitalize ${
                  activeTab === tab 
                    ? 'bg-white text-indigo-600 shadow-md shadow-indigo-500/5 ring-1 ring-slate-200/50' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {currentView === 'list' ? (
              <>
                <button 
                  onClick={() => {
                    setEditingId(null);
                    setNewOrder({ number: '', kurta: '', pant: '', shirt: '' });
                    setCurrentView('create');
                  }}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  New Order
                </button>
                <button 
                  onClick={downloadPDF}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95 group"
                >
                  <FileText className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" />
                  PDF Report
                </button>
              </>
            ) : (
              <button 
                onClick={cancelEdit}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Back to List
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        <AnimatePresence mode="wait">
          {currentView === 'create' ? (
            <motion.div 
              key="create"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-xl mx-auto"
            >
              <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-slate-200/50 border border-slate-100">
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                      {editingId ? <Pencil className="w-6 h-6 text-indigo-600" /> : <Plus className="w-6 h-6 text-indigo-600" />}
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-800">{editingId ? 'Edit Order' : 'Create New Order'}</h2>
                      <p className="text-slate-400 text-sm font-bold">{editingId ? 'Update the order details' : 'Fill in the customer details below'}</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleAddOrder} className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Customer / Order ID</label>
                    <div className="relative">
                      <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                      <input 
                        required
                        type="text" 
                        placeholder="e.g. 1720 or Rahul"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.25rem] pl-14 pr-5 py-5 text-base font-medium focus:bg-white focus:border-indigo-500/20 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all"
                        value={newOrder.number}
                        onChange={e => setNewOrder({...newOrder, number: e.target.value})}
                      />
                    </div>
                  </div>

                  {(['kurta', 'pant', 'shirt'] as const).map((field) => (
                    <div key={field} className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 capitalize">{field} Details</label>
                      <div className="relative">
                        <Package className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                        <input 
                          type="text" 
                          placeholder={`Enter ${field} status...`}
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.25rem] pl-14 pr-5 py-5 text-base font-medium focus:bg-white focus:border-indigo-500/20 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all"
                          value={newOrder[field]}
                          onChange={e => setNewOrder({...newOrder, [field]: e.target.value})}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 mt-4">
                        {QUICK_VALUES.map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setQuickValue(field, val)}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all border-2 ${
                              newOrder[field] === val 
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' 
                                : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-200 hover:text-indigo-600'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={cancelEdit}
                      className="flex-1 bg-slate-100 text-slate-600 font-black py-5 rounded-[1.5rem] hover:bg-slate-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="flex-[2] bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-indigo-200 hover:shadow-2xl hover:shadow-indigo-300 hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0 transition-all flex items-center justify-center gap-3"
                    >
                      <CheckCircle2 className="w-6 h-6" />
                      {editingId ? 'Update Order' : 'Save Order'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Stats Summary - Full Width on List View */}
              <div className="lg:col-span-12 grid grid-cols-3 gap-4">
                {[
                  { label: 'Total', value: orders.length, color: 'indigo', icon: Package },
                  { label: 'Pending', value: orders.filter(o => !o.delivered).length, color: 'amber', icon: Clock },
                  { label: 'Delivered', value: orders.filter(o => o.delivered).length, color: 'emerald', icon: CheckCircle2 }
                ].map((stat) => (
                  <div key={stat.label} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center text-center group hover:shadow-md transition-all">
                    <div className={`w-12 h-12 rounded-2xl bg-${stat.color === 'indigo' ? 'indigo' : stat.color === 'amber' ? 'amber' : 'emerald'}-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <stat.icon className={`w-6 h-6 text-${stat.color === 'indigo' ? 'indigo' : stat.color === 'amber' ? 'amber' : 'emerald'}-600`} />
                    </div>
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                    <span className="text-3xl font-black text-slate-800">{stat.value}</span>
                  </div>
                ))}
              </div>

              {/* Order List - Now takes more space */}
              <div className="lg:col-span-12 space-y-8">
                {!supabase && (
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/50 rounded-[2rem] p-8 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="bg-white p-3 rounded-2xl shadow-sm">
                        <AlertCircle className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <h3 className="text-amber-900 font-black text-lg">Supabase Setup Required</h3>
                        <p className="text-amber-700 text-sm mt-1 leading-relaxed">
                          Connect your database to save orders permanently.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <div className="flex justify-between items-end px-2">
                    <div>
                      <h2 className="text-2xl font-black text-slate-800">Recent Activity</h2>
                      <p className="text-slate-400 text-xs font-bold mt-1">Showing {filteredOrders.length} orders</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <AnimatePresence mode="popLayout">
                      {filteredOrders.map((order) => (
                        <motion.div
                          layout
                          key={order.id}
                          initial={{ opacity: 0, scale: 0.9, y: 20 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                          className={`group bg-white rounded-[2.5rem] p-6 shadow-sm border-2 transition-all hover:shadow-xl hover:shadow-slate-200/50 ${
                            order.delivered 
                              ? 'border-emerald-100/50 bg-emerald-50/10' 
                              : 'border-slate-100 hover:border-indigo-100'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-5">
                              <button 
                                onClick={() => toggleDelivered(order.id)}
                                className={`mt-1 w-14 h-14 rounded-2xl flex items-center justify-center transition-all border-4 ${
                                  order.delivered 
                                    ? 'bg-emerald-500 border-emerald-100 text-white shadow-lg shadow-emerald-200' 
                                    : 'bg-slate-50 border-slate-100 text-slate-300 hover:border-indigo-200 hover:text-indigo-600 hover:bg-white'
                                }`}
                              >
                                <Check className={`w-7 h-7 transition-all duration-500 ${order.delivered ? 'scale-110 rotate-0' : 'scale-50 rotate-45 opacity-0 group-hover:opacity-100 group-hover:scale-100 group-hover:rotate-0'}`} />
                              </button>

                              <div>
                                <div className="flex items-center gap-3">
                                  <h3 className={`text-xl font-black tracking-tight ${order.delivered ? 'text-slate-400 line-through decoration-2' : 'text-slate-800'}`}>
                                    {order.number}
                                  </h3>
                                  {order.delivered ? (
                                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ring-4 ring-emerald-50">Delivered</span>
                                  ) : (
                                    <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ring-4 ring-amber-50">In Progress</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 mt-2 text-slate-400 text-[11px] font-black uppercase tracking-widest">
                                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {new Date(order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                  <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Customer</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => startEdit(order)}
                                className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all active:scale-90"
                                title="Edit Order"
                              >
                                <Pencil className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => deleteOrder(order.id)}
                                className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all active:scale-90"
                                title="Delete Order"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>

                          <div className="mt-8 grid grid-cols-3 gap-4">
                            {[
                              { label: 'Kurta', value: order.kurta, icon: Scissors },
                              { label: 'Pant', value: order.pant, icon: Package },
                              { label: 'Shirt', value: order.shirt, icon: User }
                            ].map((item) => (
                              <div key={item.label} className={`p-4 rounded-[1.5rem] border-2 transition-colors ${
                                order.delivered 
                                  ? 'bg-white/50 border-slate-100' 
                                  : 'bg-slate-50/50 border-slate-100 group-hover:border-indigo-50 group-hover:bg-white'
                              }`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <item.icon className="w-3 h-3 text-slate-300" />
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{item.label}</p>
                                </div>
                                <p className={`text-sm font-black truncate ${
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
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="col-span-full bg-white rounded-[3rem] p-20 text-center border-4 border-dashed border-slate-100"
                      >
                        <div className="bg-slate-50 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                          <Search className="w-10 h-10 text-slate-200" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800">No matching orders</h3>
                        <p className="text-slate-400 font-bold mt-2 max-w-xs mx-auto">We couldn't find what you're looking for. Try a different search term.</p>
                        <button 
                          onClick={() => {setSearchTerm(''); setActiveTab('all');}}
                          className="mt-8 text-indigo-600 font-black text-sm hover:underline"
                        >
                          Clear all filters
                        </button>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

    </div>
  );
}
