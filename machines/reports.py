import os, io, calendar, locale
from datetime import date, timedelta, datetime
from django.conf import settings
from django.db.models import Sum, Avg, Count, Q, Min, Max
from django.utils import timezone
from collections import OrderedDict

from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm, cm
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Table, TableStyle, Paragraph,
                                Spacer, Image, PageBreak, KeepTogether)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from .models import Factory, ProductionLine, Device, DeviceLog, DeviceDailyAnalysis

FONTS_DIR = os.path.join(os.path.dirname(__file__), 'fonts')

PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
                  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']

RANGE_LABELS = {
    'today': 'امروز',
    'yesterday': 'دیروز',
    'this_week': 'این هفته',
    'last_week': 'هفته گذشته',
    'this_month': 'این ماه',
    'last_month': 'ماه گذشته',
    'this_year': 'امسال',
    'last_year': 'سال گذشته',
    '7days': '۷ روز گذشته',
    '30days': '۳۰ روز گذشته',
    '90days': '۹۰ روز گذشته',
    '365days': 'یک سال گذشته',
    'all': 'همه',
    'custom': 'سفارشی',
}

# --- Persian font setup ---
def _register_fonts():
    bold_path = os.path.join(FONTS_DIR, 'Vazirmatn-FD-Bold.ttf')
    regular_path = os.path.join(FONTS_DIR, 'Vazirmatn-FD-Regular.ttf')
    medium_path = os.path.join(FONTS_DIR, 'Vazirmatn-FD-Medium.ttf')

    bold = os.path.join(FONTS_DIR, 'Vazirmatn-Bold.ttf')
    regular = os.path.join(FONTS_DIR, 'Vazirmatn-Regular.ttf')

    for p in [bold_path, bold]:
        if os.path.exists(p):
            pdfmetrics.registerFont(TTFont('VazirBold', p))
            break
    for p in [regular_path, regular]:
        if os.path.exists(p):
            pdfmetrics.registerFont(TTFont('Vazir', p))
            break
    for p in [medium_path]:
        if os.path.exists(p):
            pdfmetrics.registerFont(TTFont('VazirMedium', p))
            break

    if 'Vazir' not in pdfmetrics._fonts:
        pdfmetrics.registerFont(TTFont('Vazir', regular))
    if 'VazirBold' not in pdfmetrics._fonts:
        pdfmetrics.registerFont(TTFont('VazirBold', bold))

_register_fonts()

STYLES = {
    'title': ParagraphStyle('TitleFa', fontName='VazirBold', fontSize=18, alignment=1, spaceAfter=6),
    'subtitle': ParagraphStyle('SubFa', fontName='Vazir', fontSize=10, alignment=1, textColor=colors.HexColor('#555'), spaceAfter=4),
    'header': ParagraphStyle('HeaderFa', fontName='VazirBold', fontSize=10, alignment=0, textColor=colors.white),
    'cell': ParagraphStyle('CellFa', fontName='Vazir', fontSize=8, alignment=0, leading=12),
    'cell_center': ParagraphStyle('CellFaCenter', fontName='Vazir', fontSize=8, alignment=1, leading=12),
    'section': ParagraphStyle('SectionFa', fontName='VazirBold', fontSize=12, alignment=0, textColor=colors.HexColor('#1a56db'), spaceAfter=8, spaceBefore=12),
    'meta': ParagraphStyle('MetaFa', fontName='Vazir', fontSize=8, alignment=0, textColor=colors.HexColor('#666')),
}

# --- Date range helpers ---
def get_date_range(range_key, start_date=None, end_date=None):
    today = date.today()
    if range_key == 'today':
        return today, today
    elif range_key == 'yesterday':
        y = today - timedelta(days=1)
        return y, y
    elif range_key == 'this_week':
        start = today - timedelta(days=today.weekday())
        return start, today
    elif range_key == 'last_week':
        start = today - timedelta(days=today.weekday() + 7)
        return start, start + timedelta(days=6)
    elif range_key == 'this_month':
        return today.replace(day=1), today
    elif range_key == 'last_month':
        first = today.replace(day=1) - timedelta(days=1)
        return first.replace(day=1), first
    elif range_key == 'this_year':
        return today.replace(month=1, day=1), today
    elif range_key == 'last_year':
        return today.replace(year=today.year - 1, month=1, day=1), today.replace(year=today.year - 1, month=12, day=31)
    elif range_key == '7days':
        return today - timedelta(days=7), today
    elif range_key == '30days':
        return today - timedelta(days=30), today
    elif range_key == '90days':
        return today - timedelta(days=90), today
    elif range_key == '365days':
        return today - timedelta(days=365), today
    elif range_key == 'all':
        return None, None
    elif range_key == 'custom' and start_date and end_date:
        return start_date, end_date
    return today - timedelta(days=30), today

def _p(value, decimals=1):
    if value is None:
        return '۰'
    return f'{value:,.{decimals}f}'.translate(str.maketrans('0123456789-,.', '۰۱۲۳۴۵۶۷۸۹-،.'))

def _factory_header(factory):
    return [
        f'شرکت: {factory.name}',
        f'آدرس: {factory.address}',
    ]

# ────────────────────────────────── EXCEL ──────────────────────────────────

def _excel_style(ws):
    header_font = Font(name='Vazirmatn', bold=True, color='FFFFFF', size=11)
    header_fill = PatternFill(start_color='1a56db', end_color='1a56db', fill_type='solid')
    header_align = Alignment(horizontal='center', vertical='center', wrap_text=True)
    thin_border = Border(
        left=Side(style='thin'), right=Side(style='thin'),
        top=Side(style='thin'), bottom=Side(style='thin')
    )
    return header_font, header_fill, header_align, thin_border

def _write_rows(ws, rows, row_offset=1):
    hf, hfill, halign, border = _excel_style(ws)
    for r_idx, row in enumerate(rows, start=row_offset):
        for c_idx, val in enumerate(row, start=1):
            cell = ws.cell(row=r_idx, column=c_idx, value=val)
            cell.border = border
            if r_idx == row_offset:
                cell.font = hf
                cell.fill = hfill
                cell.alignment = halign
            else:
                cell.alignment = Alignment(horizontal='center', vertical='center')

def excel_performance(factory, lines_data, date_from, date_to, date_label, factory_obj=None):
    wb = Workbook()
    ws = wb.active
    ws.title = 'گزارش عملکرد'

    data_rows = []
    data_rows.append(['گزارش عملکرد - ' + (factory.name if factory else 'کل کارخانه‌ها')] + [''] * 7)
    data_rows.append(['بازه: ' + date_label] + [''] * 7)
    data_rows.append([])
    headers = ['ردیف', 'خط تولید', 'تعداد ثبت', 'ساعت کارکرد', 'ساعت توقف',
               'ورودی (تن)', 'محصول (تن)', 'باطله (تن)', 'بازدهی (%)']

    data_rows.append(headers)
    for i, (line_name, line_id, stats) in enumerate(lines_data, 1):
        n = stats.get('count', 0)
        run = stats.get('runtime', 0)
        down = stats.get('downtime', 0)
        feed = stats.get('feed', 0)
        prod = stats.get('product', 0)
        tail = stats.get('tailing', 0)
        eff = stats.get('efficiency', 0)
        data_rows.append([i, line_name, n, run, down, feed, prod, tail, eff])

    title_font = Font(name='Vazirmatn', bold=True, size=14)
    subtitle_font = Font(name='Vazirmatn', size=10)

    for r_idx, row in enumerate(data_rows, 1):
        for c_idx, val in enumerate(row, 1):
            cell = ws.cell(row=r_idx, column=c_idx)
            cell.value = val
            if r_idx == 1:
                cell.font = title_font
                cell.alignment = Alignment(horizontal='center')
            elif r_idx == 2:
                cell.font = subtitle_font
                cell.alignment = Alignment(horizontal='center')

    _write_rows(ws, data_rows[3:], row_offset=4)

    for col in range(1, 10):
        ws.column_dimensions[get_column_letter(col)].width = 14

    total_runtime = sum(s.get('runtime', 0) for _, _, s in lines_data)
    total_downtime = sum(s.get('downtime', 0) for _, _, s in lines_data)
    total_feed = sum(s.get('feed', 0) for _, _, s in lines_data)
    total_product = sum(s.get('product', 0) for _, _, s in lines_data)
    total_tailing = sum(s.get('tailing', 0) for _, _, s in lines_data)

    last_row = len(data_rows) + 3
    ws.cell(row=last_row, column=1, value='جمع کل').font = Font(name='Vazirmatn', bold=True, size=11)
    ws.cell(row=last_row, column=2, value='-')
    ws.cell(row=last_row, column=3, value='-')
    ws.cell(row=last_row, column=4, value=total_runtime).font = Font(name='Vazirmatn', bold=True, size=11)
    ws.cell(row=last_row, column=5, value=total_downtime).font = Font(name='Vazirmatn', bold=True, size=11)
    ws.cell(row=last_row, column=6, value=total_feed).font = Font(name='Vazirmatn', bold=True, size=11)
    ws.cell(row=last_row, column=7, value=total_product).font = Font(name='Vazirmatn', bold=True, size=11)
    ws.cell(row=last_row, column=8, value=total_tailing).font = Font(name='Vazirmatn', bold=True, size=11)
    eff_all = (total_product / total_feed * 100) if total_feed else 0
    ws.cell(row=last_row, column=9, value=round(eff_all, 1)).font = Font(name='Vazirmatn', bold=True, size=11)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf

def excel_analysis(factory, analyses_data, date_from, date_to, date_label):
    wb = Workbook()
    ws = wb.active
    ws.title = 'گزارش آنالیز'

    title_font = Font(name='Vazirmatn', bold=True, size=14)
    subtitle_font = Font(name='Vazirmatn', size=10)

    ws.cell(row=1, column=1, value=f'گزارش آنالیز - {factory.name if factory else "کل کارخانه‌ها"}').font = title_font
    ws.cell(row=1, column=1).alignment = Alignment(horizontal='center')
    ws.cell(row=2, column=1, value=f'بازه: {date_label}').font = subtitle_font
    ws.cell(row=2, column=1).alignment = Alignment(horizontal='center')

    headers = ['ردیف', 'دستگاه', 'نقطه نمونه', 'تاریخ', 'پارامتر ۱', 'پارامتر ۲', 'شرح']

    data_rows = [headers]
    for i, item in enumerate(analyses_data, 1):
        data_rows.append([
            i,
            item.get('device_name', ''),
            item.get('sample_point_display', ''),
            item.get('date', ''),
            item.get('value_1', ''),
            item.get('value_2', ''),
            item.get('analysis_text', ''),
        ])

    _write_rows(ws, data_rows, row_offset=4)
    for col in range(1, 8):
        ws.column_dimensions[get_column_letter(col)].width = 16

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf

# ────────────────────────────────── PDF ──────────────────────────────────

def _pdf_header_footer(canvas, doc, title, factory=None, date_label=''):
    canvas.saveState()
    canvas.setFont('Vazir', 7)
    canvas.setFillColor(colors.HexColor('#666'))
    w, h = A4
    canvas.drawCentredString(w / 2, 15, f'صفحه {doc.page}')
    canvas.drawString(20, 15, f'تاریخ چاپ: {date.today().strftime("%Y-%m-%d")}')
    if factory:
        canvas.drawRightString(w - 20, 15, f'{factory.name} | {title}')
    canvas.restoreState()

def _make_table(data, col_widths=None):
    style = TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('FONTNAME', (0, 0), (-1, 0), 'VazirBold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Vazir'),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a56db')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#ccc')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ])
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(style)
    return t

def pdf_performance(factory, lines_data, date_from, date_to, date_label, factory_obj=None):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=15*mm, leftMargin=15*mm,
                            topMargin=20*mm, bottomMargin=20*mm)

    elements = []
    elements.append(Paragraph('گزارش عملکرد خطوط تولید', STYLES['title']))
    elements.append(Spacer(1, 4))

    if factory:
        elements.append(Paragraph(f'شرکت: {factory.name}', STYLES['subtitle']))
        if factory.address:
            elements.append(Paragraph(f'آدرس: {factory.address}', STYLES['meta']))

    elements.append(Paragraph(f'بازه گزارش: {date_label}', STYLES['meta']))
    elements.append(Spacer(1, 10))

    header = ['ردیف', 'خط تولید', 'تعداد ثبت', 'ساعت کارکرد', 'ساعت توقف',
              'خوراک (تن)', 'محصول (تن)', 'باطله (تن)', 'بازدهی (%)']

    col_widths = [30, 90, 50, 55, 55, 55, 55, 55, 50]

    rows = [header]
    for i, (line_name, line_id, stats) in enumerate(lines_data, 1):
        n = stats.get('count', 0)
        run = stats.get('runtime', 0)
        down = stats.get('downtime', 0)
        feed = stats.get('feed', 0)
        prod = stats.get('product', 0)
        tail = stats.get('tailing', 0)
        eff = stats.get('efficiency', 0)

        rows.append([
            str(i), line_name, _p(n, 0),
            _p(run), _p(down), _p(feed),
            _p(prod), _p(tail), f'{_p(eff)}%'
        ])

    t = _make_table(rows, col_widths)
    elements.append(t)

    if len(lines_data) > 1:
        elements.append(Spacer(1, 12))
        total_runtime = sum(s.get('runtime', 0) for _, _, s in lines_data)
        total_downtime = sum(s.get('downtime', 0) for _, _, s in lines_data)
        total_feed = sum(s.get('feed', 0) for _, _, s in lines_data)
        total_product = sum(s.get('product', 0) for _, _, s in lines_data)
        total_tailing = sum(s.get('tailing', 0) for _, _, s in lines_data)
        eff_all = (total_product / total_feed * 100) if total_feed else 0

        summary = [
            ['', '', 'جمع کل', _p(total_runtime), _p(total_downtime),
             _p(total_feed), _p(total_product), _p(total_tailing), f'{_p(eff_all)}%']
        ]
        st = _make_table(summary, col_widths)
        elements.append(st)

    doc.build(elements, onFirstPage=lambda c, d: _pdf_header_footer(c, d, 'گزارش عملکرد', factory, date_label),
              onLaterPages=lambda c, d: _pdf_header_footer(c, d, 'گزارش عملکرد', factory, date_label))
    buf.seek(0)
    return buf

def pdf_analysis(factory, analyses_data, date_from, date_to, date_label, factory_obj=None):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), rightMargin=12*mm, leftMargin=12*mm,
                            topMargin=18*mm, bottomMargin=18*mm)

    elements = []
    elements.append(Paragraph('گزارش آنالیز روزانه', STYLES['title']))
    elements.append(Spacer(1, 4))

    if factory:
        elements.append(Paragraph(f'شرکت: {factory.name}', STYLES['subtitle']))
    elements.append(Paragraph(f'بازه گزارش: {date_label}', STYLES['meta']))
    elements.append(Spacer(1, 8))

    header = ['ردیف', 'دستگاه', 'خط تولید', 'نقطه نمونه', 'تاریخ', 'پارامتر ۱', 'پارامتر ۲', 'شرح']
    col_widths = [25, 80, 80, 60, 55, 55, 55, 120]

    rows = [header]
    for i, item in enumerate(analyses_data, 1):
        rows.append([
            str(i),
            item.get('device_name', ''),
            item.get('line_name', ''),
            item.get('sample_point_display', ''),
            str(item.get('date', '')),
            _p(item.get('value_1')),
            _p(item.get('value_2')),
            item.get('analysis_text', '')[:60],
        ])

    t = _make_table(rows, col_widths)
    elements.append(t)

    doc.build(elements, onFirstPage=lambda c, d: _pdf_header_footer(c, d, 'گزارش آنالیز', factory, date_label),
              onLaterPages=lambda c, d: _pdf_header_footer(c, d, 'گزارش آنالیز', factory, date_label))
    buf.seek(0)
    return buf

# ─────────────────────────────── QUERIES ───────────────────────────────

def performance_data(factory, date_from, date_to):
    qs = DeviceLog.objects.all()
    if factory:
        qs = qs.filter(line__factory=factory)
    if date_from:
        qs = qs.filter(date__gte=date_from)
    if date_to:
        qs = qs.filter(date__lte=date_to)

    lines_qs = qs.values('line_id', 'line__name').annotate(
        count=Count('id'),
        runtime=Sum('runtime_hours'),
        downtime=Sum('downtime_hours'),
        feed=Sum('feed_tonnage'),
        product=Sum('product_tonnage'),
        tailing=Sum('tailing_tonnage'),
    ).order_by('-line__name')

    lines_data = []
    for l in lines_qs:
        eff = (l['product'] / l['feed'] * 100) if l['feed'] and l['feed'] > 0 else 0
        stats = {
            'count': l['count'],
            'runtime': float(l['runtime'] or 0),
            'downtime': float(l['downtime'] or 0),
            'feed': float(l['feed'] or 0),
            'product': float(l['product'] or 0),
            'tailing': float(l['tailing'] or 0),
            'efficiency': round(eff, 1),
        }
        lines_data.append((l['line__name'], l['line_id'], stats))

    return lines_data

def analysis_data(factory, date_from, date_to):
    qs = DeviceDailyAnalysis.objects.select_related(
        'device', 'device__line', 'shift'
    )

    if factory:
        qs = qs.filter(device__line__factory=factory)
    if date_from:
        qs = qs.filter(date__gte=date_from)
    if date_to:
        qs = qs.filter(date__lte=date_to)

    qs = qs.order_by('-date', 'device__line__name', 'device__name')

    results = []
    for a in qs:
        results.append({
            'device_name': a.device.name if a.device else '',
            'line_name': a.device.line.name if a.device and hasattr(a.device, 'line') else '',
            'sample_point': a.sample_point or '',
            'sample_point_display': a.get_sample_point_display() or '',
            'shift_name': a.shift.name if a.shift else '',
            'date': a.date.isoformat() if a.date else '',
            'value_1': a.value_1,
            'value_2': a.value_2,
            'analysis_text': a.analysis_text or '',
        })

    return results

# ─────────────────────────────── MAIN ───────────────────────────────

def generate_performance_report(factory_id, range_key, date_from=None, date_to=None, fmt='excel'):
    factory = Factory.objects.filter(id=factory_id).first() if factory_id else None
    d_from, d_to = get_date_range(range_key, date_from, date_to)
    date_label = RANGE_LABELS.get(range_key, 'سفارشی')

    if range_key == 'custom' and date_from and date_to:
        date_label = f'{date_from} تا {date_to}'
    elif d_from and d_to:
        if d_from == d_to:
            date_label = d_from.isoformat()
        else:
            date_label = f'{d_from} تا {d_to}'
    else:
        date_label = 'همه موارد'

    lines_data = performance_data(factory, d_from, d_to)

    if fmt == 'excel':
        buf = excel_performance(factory, lines_data, d_from, d_to, date_label)
        return buf, 'xlsx'
    else:
        buf = pdf_performance(factory, lines_data, d_from, d_to, date_label)
        return buf, 'pdf'

def generate_analysis_report(factory_id, range_key, date_from=None, date_to=None, fmt='excel'):
    factory = Factory.objects.filter(id=factory_id).first() if factory_id else None
    d_from, d_to = get_date_range(range_key, date_from, date_to)
    date_label = RANGE_LABELS.get(range_key, 'سفارشی')

    if range_key == 'custom' and date_from and date_to:
        date_label = f'{date_from} تا {date_to}'
    elif d_from and d_to:
        if d_from == d_to:
            date_label = d_from.isoformat()
        else:
            date_label = f'{d_from} تا {d_to}'
    else:
        date_label = 'همه موارد'

    analyses = analysis_data(factory, d_from, d_to)

    if fmt == 'excel':
        buf = excel_analysis(factory, analyses, d_from, d_to, date_label)
        return buf, 'xlsx'
    else:
        buf = pdf_analysis(factory, analyses, d_from, d_to, date_label)
        return buf, 'pdf'
